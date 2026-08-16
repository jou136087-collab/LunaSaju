/* =========================================================================
 * store.js — 저장 어댑터
 *
 * localStorage 가 1차 저장소다. 로그인이 붙으면 auth.js 가 onWrite 로
 * 변경을 받아 Firestore 에 되올리고, 로그인 직후에는 클라우드 값을
 * setProfile(v, {silent:true}) 로 내려 심는다.
 * 이 구조 덕분에 app.js·couple.js 의 동기 호출부는 그대로 둘 수 있다.
 *
 * window.LuneStore 로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var KEY = {
    theme: 'lune-theme',
    profile: 'lune-profile',
    partner: 'lune-partner',
  };

  /* localStorage 는 시크릿 모드·차단 설정에서 던질 수 있다. 전부 감싼다. */
  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeRaw(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  function removeRaw(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function readJSON(key) {
    var raw = readRaw(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { removeRaw(key); return null; }
  }
  function writeJSON(key, value) { return writeRaw(key, JSON.stringify(value)); }

  /* 저장하는 필드를 명시적으로 고른다 — 폼 객체를 통째로 넣지 않는다 */
  function pick(v) {
    if (!v) return null;
    return {
      year: v.year, month: v.month, day: v.day,
      hour: v.hour, minute: v.minute,
      gender: v.gender,
      cityName: v.cityName,
      lon: v.lon,
      useSolarTime: !!v.useSolarTime,
      unknownTime: !!v.unknownTime,
      savedAt: new Date().toISOString(),
    };
  }

  /* 쓰기 관찰자 — auth.js 가 클라우드로 되올리는 데 쓴다.
   * silent 로 쓰면(클라우드에서 내려온 값) 알리지 않는다. 안 그러면 루프가 돈다. */
  var writeListeners = [];
  function notify(key, value, opts) {
    if (opts && opts.silent) return;
    writeListeners.forEach(function (fn) {
      try { fn(key, value); } catch (e) { console.error('[store] onWrite', e); }
    });
  }

  global.LuneStore = {
    available: (function () {
      try {
        localStorage.setItem('__lune_probe', '1');
        localStorage.removeItem('__lune_probe');
        return true;
      } catch (e) { return false; }
    })(),

    onWrite: function (fn) { writeListeners.push(fn); },

    getTheme: function () { return readRaw(KEY.theme); },
    setTheme: function (v) { return writeRaw(KEY.theme, v); },

    getProfile: function () { return readJSON(KEY.profile); },
    setProfile: function (v, opts) {
      var picked = pick(v);
      var ok = writeJSON(KEY.profile, picked);
      notify('profile', picked, opts);
      return ok;
    },
    clearProfile: function (opts) {
      var ok = removeRaw(KEY.profile);
      notify('profile', null, opts);
      return ok;
    },
    hasProfile: function () { return !!readJSON(KEY.profile); },

    getPartner: function () { return readJSON(KEY.partner); },
    setPartner: function (v, opts) {
      var picked = pick(v);
      var ok = writeJSON(KEY.partner, picked);
      notify('partner', picked, opts);
      return ok;
    },
    clearPartner: function (opts) {
      var ok = removeRaw(KEY.partner);
      notify('partner', null, opts);
      return ok;
    },
  };
})(window);
