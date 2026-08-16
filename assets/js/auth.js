/* =========================================================================
 * auth.js — 구글 로그인 · 프로필 동기화 · 방문 집계
 *
 * 설계 원칙
 *  1) firebase-config.js 가 비어 있으면 아무것도 하지 않는다.
 *     그 상태의 사이트는 Phase A 와 완전히 동일하게 동작한다(file:// 포함).
 *  2) SDK 는 정적 import 가 아니라 **동적 import** 로 가져온다.
 *     정적 module 스크립트를 쓰면 설정이 없어도 file:// 에서 CORS 로 깨진다.
 *  3) 저장은 localStorage 가 1차, Firestore 가 2차다.
 *     로그인하면 클라우드 값을 내려받아 localStorage 에 심고,
 *     이후 localStorage 쓰기를 클라우드로 되올린다.
 *     덕분에 app.js·couple.js 의 동기 API 호출부를 건드릴 필요가 없다.
 *
 * window.LuneAuth 로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var CFG = global.LUNE_FIREBASE || {};
  var conf = CFG.config || {};
  var ADMIN_UIDS = CFG.adminUids || [];
  var CONFIGURED = !!(conf.apiKey && conf.projectId);
  var BASE = 'https://www.gstatic.com/firebasejs/' + (CFG.sdkVersion || '12.17.1') + '/';

  var Store = global.LuneStore;

  var listeners = [];
  var state = {
    configured: CONFIGURED,
    ready: !CONFIGURED,   // 설정이 없으면 즉시 '준비 완료'
    user: null,
    error: null,
  };

  var sdk = null;   // { auth, db, ...함수들 }
  var readyResolve;
  var readyPromise = new Promise(function (r) { readyResolve = r; });

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error('[auth] listener', e); }
    });
  }

  function finishBoot() {
    state.ready = true;
    readyResolve(state);
    emit();
  }

  function isAdmin(uid) { return ADMIN_UIDS.indexOf(uid) >= 0; }

  /* 로컬 날짜 기준 YYYY-MM-DD (사용자가 한국이므로 UTC 를 쓰지 않는다) */
  function todayKey() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* =====================================================================
   * 부팅
   * =================================================================== */
  async function boot() {
    if (!CONFIGURED) { finishBoot(); return; }

    try {
      var mods = await Promise.all([
        import(BASE + 'firebase-app.js'),
        import(BASE + 'firebase-auth.js'),
        import(BASE + 'firebase-firestore.js'),
      ]);
      var appMod = mods[0], authMod = mods[1], dbMod = mods[2];

      var app = appMod.initializeApp(conf);
      sdk = {
        auth: authMod.getAuth(app),
        db: dbMod.getFirestore(app),
        GoogleAuthProvider: authMod.GoogleAuthProvider,
        signInWithPopup: authMod.signInWithPopup,
        signInWithRedirect: authMod.signInWithRedirect,
        getRedirectResult: authMod.getRedirectResult,
        onAuthStateChanged: authMod.onAuthStateChanged,
        fbSignOut: authMod.signOut,
        doc: dbMod.doc,
        getDoc: dbMod.getDoc,
        setDoc: dbMod.setDoc,
        collection: dbMod.collection,
        getDocs: dbMod.getDocs,
        query: dbMod.query,
        orderBy: dbMod.orderBy,
        limit: dbMod.limit,
        serverTimestamp: dbMod.serverTimestamp,
        increment: dbMod.increment,
      };

      // 리다이렉트 방식으로 돌아온 경우를 먼저 처리한다
      try { await sdk.getRedirectResult(sdk.auth); } catch (e) { /* 무시 */ }

      sdk.onAuthStateChanged(sdk.auth, function (u) {
        handleUser(u).catch(function (e) { console.error('[auth] handleUser', e); });
      });
    } catch (e) {
      console.error('[auth] 초기화 실패', e);
      state.error = e && e.message ? e.message : String(e);
      finishBoot();
    }
  }

  async function handleUser(u) {
    if (!u) {
      state.user = null;
      if (!state.ready) finishBoot(); else emit();
      await logVisit(null);
      return;
    }

    state.user = {
      uid: u.uid,
      displayName: u.displayName || '이름 없음',
      email: u.email || '',
      photoURL: u.photoURL || '',
      isAdmin: isAdmin(u.uid),
    };

    try {
      await ensureUserDoc(u);
      await pullProfile(u.uid);
    } catch (e) {
      console.error('[auth] 프로필 동기화 실패', e);
    }

    if (!state.ready) finishBoot(); else emit();
    await logVisit(u);
  }

  /* =====================================================================
   * 사용자 문서
   * =================================================================== */
  async function ensureUserDoc(u) {
    var ref = sdk.doc(sdk.db, 'users', u.uid);
    var snap = await sdk.getDoc(ref);
    var base = {
      displayName: u.displayName || '이름 없음',
      email: u.email || '',
      photoURL: u.photoURL || '',
      lastSeenAt: sdk.serverTimestamp(),
    };
    if (!snap.exists()) {
      base.createdAt = sdk.serverTimestamp();
      base.visits = 0;
    }
    await sdk.setDoc(ref, base, { merge: true });
  }

  /** 클라우드 프로필을 내려받아 localStorage 에 심는다 */
  async function pullProfile(uid) {
    var snap = await sdk.getDoc(sdk.doc(sdk.db, 'users', uid));
    if (!snap.exists()) return;
    var p = snap.data().profile;
    if (p && p.year) {
      Store.setProfile(p, { silent: true });   // 되올리기 루프 방지
      emit();
    }
  }

  /** localStorage 에 프로필이 쓰이면 클라우드로 올린다. null 이면 클라우드에서도 지운다. */
  function pushProfile(profile) {
    if (!sdk || !state.user) return;
    sdk.setDoc(
      sdk.doc(sdk.db, 'users', state.user.uid),
      { profile: profile || null, lastSeenAt: sdk.serverTimestamp() },
      { merge: true },
    ).catch(function (e) { console.error('[auth] 프로필 업로드 실패', e); });
  }

  if (Store && Store.onWrite) {
    Store.onWrite(function (key, value) {
      if (key === 'profile') pushProfile(value);
    });
  }

  /* =====================================================================
   * 방문 집계
   *  - 로그인 사용자는 명단에 남는다 (users/{uid}.visits, lastSeenAt)
   *  - 비로그인 방문은 숫자만 센다 (stats 카운터, 개인 식별 정보 없음)
   *  - 브라우저 세션당 1회로 묶는다
   * =================================================================== */
  async function logVisit(u) {
    if (!sdk) return;
    var mark = 'lune-visit-' + todayKey();
    try {
      if (sessionStorage.getItem(mark)) return;
      sessionStorage.setItem(mark, '1');
    } catch (e) { /* 시크릿 모드 등 — 그냥 진행 */ }

    var bump = function (id) {
      return sdk.setDoc(
        sdk.doc(sdk.db, 'stats', id),
        { count: sdk.increment(1), updatedAt: sdk.serverTimestamp() },
        { merge: true },
      );
    };

    try {
      await Promise.all([bump('global'), bump('day_' + todayKey())]);
      if (u) {
        await sdk.setDoc(
          sdk.doc(sdk.db, 'users', u.uid),
          { visits: sdk.increment(1), lastSeenAt: sdk.serverTimestamp() },
          { merge: true },
        );
      }
    } catch (e) {
      console.warn('[auth] 방문 집계 실패 (무시)', e && e.code);
    }
  }

  /* =====================================================================
   * 공개 API
   * =================================================================== */
  async function signIn() {
    if (!sdk) return;
    var provider = new sdk.GoogleAuthProvider();
    try {
      await sdk.signInWithPopup(sdk.auth, provider);
    } catch (e) {
      // iOS Safari 등 팝업이 막히는 환경은 리다이렉트로 되돌린다
      var code = e && e.code ? e.code : '';
      if (code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/operation-not-supported-in-this-environment') {
        try { await sdk.signInWithRedirect(sdk.auth, provider); return; } catch (e2) { e = e2; }
      }
      console.error('[auth] 로그인 실패', e);
      state.error = (e && e.message) ? e.message : '로그인에 실패했습니다';
      emit();
    }
  }

  async function signOutNow() {
    if (!sdk) return;
    try { await sdk.fbSignOut(sdk.auth); } catch (e) { console.error('[auth] 로그아웃 실패', e); }
  }

  /** 관리자 전용 — 로그인 사용자 명단 */
  async function listUsers(max) {
    if (!sdk || !state.user || !state.user.isAdmin) return [];
    var q = sdk.query(
      sdk.collection(sdk.db, 'users'),
      sdk.orderBy('lastSeenAt', 'desc'),
      sdk.limit(max || 200),
    );
    var snap = await sdk.getDocs(q);
    var out = [];
    snap.forEach(function (d) { out.push(Object.assign({ uid: d.id }, d.data())); });
    return out;
  }

  /** 관리자 전용 — 방문 수 */
  async function getStats(days) {
    if (!sdk || !state.user || !state.user.isAdmin) return null;
    var n = days || 14;
    var ids = ['global'];
    var labels = [];
    var d = new Date();
    for (var i = 0; i < n; i++) {
      var t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
      var p = function (x) { return String(x).padStart(2, '0'); };
      var key = t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
      ids.push('day_' + key);
      labels.push(key);
    }
    var snaps = await Promise.all(ids.map(function (id) {
      return sdk.getDoc(sdk.doc(sdk.db, 'stats', id));
    }));
    var total = snaps[0].exists() ? (snaps[0].data().count || 0) : 0;
    var daily = labels.map(function (label, i) {
      var s = snaps[i + 1];
      return { date: label, count: s.exists() ? (s.data().count || 0) : 0 };
    });
    return { total: total, daily: daily };
  }

  global.LuneAuth = {
    get configured() { return state.configured; },
    get ready() { return state.ready; },
    get user() { return state.user; },
    get error() { return state.error; },
    whenReady: function () { return readyPromise; },
    onChange: function (fn) { listeners.push(fn); fn(state); },
    signIn: signIn,
    signOut: signOutNow,
    listUsers: listUsers,
    getStats: getStats,
  };

  boot();
})(window);
