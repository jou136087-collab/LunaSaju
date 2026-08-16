/* =========================================================================
 * layout.js — 셸 (사이드바 · 상단바 · 푸터 · 테마 · 드로어 · 리빌)
 *
 * 멀티페이지 구성이다. 사이드바를 5개 HTML 에 복붙하면 메뉴 하나 고칠 때
 * 5곳을 고쳐야 하므로, 셸 마크업은 이 파일이 만들어 넣는다.
 * 각 페이지는 <body data-page="..."> 로 자기가 누구인지만 알려준다.
 *
 * window.LuneLayout 으로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var A = global.Astro, D = global.SajuData, Store = global.LuneStore;
  var $ = function (s) { return document.querySelector(s); };
  var root = document.documentElement;
  var PAGE = document.body.dataset.page || 'saju';

  var NAV = [
    { page: 'saju',      href: 'index.html',     num: '01', label: '명식 짓기' },
    { page: 'couple',    href: 'couple.html',    num: '02', label: '커플 궁합' },
    { page: 'method',    href: 'method.html',    num: '03', label: '읽는 법' },
    { page: 'principle', href: 'principle.html', num: '04', label: '계산 원리' },
    { page: 'legal',     href: 'legal.html',     num: '05', label: '저작권 · 고지' },
  ];
  /* 관리자에게만 붙는 항목 — 로그인 상태가 확인된 뒤 추가된다 */
  var ADMIN_NAV = { page: 'admin', href: 'admin.html', num: '·', label: '방문 현황' };

  /* ── 오늘의 일진 — 오행 구조까지 ─────────────────────────────────── */
  function todayPillar() {
    var now = new Date();
    var idx = ((A.toJDN(now.getFullYear(), now.getMonth() + 1, now.getDate()) - 11) % 60 + 60) % 60;
    var stem = D.STEMS[idx % 10];
    var branch = D.BRANCHES[idx % 12];
    return {
      date: now,
      index: idx,
      stem: stem,
      branch: branch,
      hidden: D.HIDDEN_STEMS[idx % 12].map(function (i) { return D.STEMS[i]; }),
    };
  }

  function todayHTML() {
    var t = todayPillar();
    var E = D.ELEMENTS;
    var cls = function (k) { return 'el-' + k; };
    var pol = function (yin) { return yin ? '음' : '양'; };

    var row = function (label, s, extra) {
      return '<div class="today__row">' +
        '<dt>' + label + '</dt>' +
        '<dd><b class="' + cls(s.element) + '">' + s.hanja + '</b>' +
          '<span>' + s.ko + ' · ' + E[s.element].hanja + E[s.element].ko + ' ' + pol(s.yin) +
          (extra ? ' · ' + extra : '') + '</span></dd>' +
      '</div>';
    };

    return '' +
      '<span class="micro">오늘의 일진</span>' +
      '<div class="today__ganji">' +
        '<span class="' + cls(t.stem.element) + '">' + t.stem.hanja + '</span>' +
        '<span class="' + cls(t.branch.element) + '">' + t.branch.hanja + '</span>' +
      '</div>' +
      '<p class="today__ko">' + t.stem.ko + t.branch.ko + '일 · 60갑자 ' + (t.index + 1) + '번째</p>' +
      '<dl class="today__rows">' +
        row('천간', t.stem) +
        row('지지', t.branch, t.branch.animal) +
        '<div class="today__row">' +
          '<dt>지장간</dt>' +
          '<dd><span class="today__hidden">' +
            t.hidden.map(function (s) {
              return '<b class="' + cls(s.element) + '">' + s.hanja + '</b>';
            }).join('') +
          '</span><span>속에 든 기운</span></dd>' +
        '</div>' +
      '</dl>';
  }

  /* ── 셸 주입 ─────────────────────────────────────────────────────── */
  var year = new Date().getFullYear();

  var topbar = $('#topbar');
  if (topbar) {
    topbar.innerHTML =
      '<button class="icon-btn" id="drawerToggle" type="button" ' +
              'aria-label="메뉴 열기" aria-expanded="false" aria-controls="sidebar">' +
        '<span class="icon-burger"></span>' +
      '</button>' +
      '<a class="brand" href="index.html"><span class="moon" aria-hidden="true"></span><span>LUNE</span></a>' +
      '<button class="icon-btn" id="themeToggleTop" type="button" aria-label="밝기 전환">' +
        '<span class="moon" aria-hidden="true"></span>' +
      '</button>';
  }

  var side = $('#sidebar');
  if (side) {
    side.innerHTML =
      '<a class="brand brand--side" href="index.html">' +
        '<span class="moon" aria-hidden="true"></span><span>LUNE</span>' +
      '</a>' +
      '<nav class="side__nav" id="sideNav" aria-label="주요 메뉴"></nav>' +
      '<div class="side__foot">' +
        '<div class="today" id="todayGanji">' + todayHTML() + '</div>' +
        '<div class="authbox" id="authSlot" hidden></div>' +
        '<button class="side__theme" id="themeToggleSide" type="button">' +
          '<span class="moon" aria-hidden="true"></span><span id="themeLabel">어둡게</span>' +
        '</button>' +
        '<p class="side__copy micro">© ' + year + ' LUNE</p>' +
      '</div>';
  }

  function renderNav(withAdmin) {
    var box = $('#sideNav');
    if (!box) return;
    var items = withAdmin ? NAV.concat([ADMIN_NAV]) : NAV;
    box.innerHTML = items.map(function (n) {
      var on = (n.page === PAGE);
      return '<a href="' + n.href + '"' + (on ? ' aria-current="page"' : '') +
        (n.page === 'admin' ? ' class="side__admin"' : '') + '>' +
        '<span class="side__num">' + n.num + '</span>' + n.label + '</a>';
    }).join('');
  }
  renderNav(false);

  var footer = $('#footer');
  if (footer) {
    footer.innerHTML =
      '<div class="wrap footer__inner">' +
        '<div class="footer__brand"><span class="moon" aria-hidden="true"></span><span>LUNE</span></div>' +
        '<p class="footer__text">' +
          '전통 명리학의 계산 규칙을 그대로 구현한 결과이며, 해석은 참고용입니다. ' +
          '의료·법률·투자 등 중요한 결정의 근거로 삼지 마세요.' +
        '</p>' +
        '<p class="footer__meta micro">' +
          '<span>절기 오차 ±1분</span>' +
          '<span>양력 · 대한민국 출생 기준</span>' +
          '<a href="legal.html">저작권 · 고지</a>' +
          '<span>© ' + year + ' LUNE</span>' +
        '</p>' +
      '</div>';
  }

  document.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = String(year); });

  /* ── 테마 ────────────────────────────────────────────────────────── */
  function setTheme(next, persist) {
    root.setAttribute('data-theme', next);
    var label = $('#themeLabel');
    if (label) label.textContent = (next === 'dark') ? '밝게' : '어둡게';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#121110' : '#F4F1EA');
    if (persist !== false) Store.setTheme(next);
    if (global.LuneSky) global.LuneSky.refresh();
  }

  var saved = Store.getTheme();
  if (!saved && global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) {
    saved = 'dark';
  }
  setTheme(saved || 'light', false);

  function toggleTheme() {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
  }
  ['#themeToggleSide', '#themeToggleTop'].forEach(function (sel) {
    var b = $(sel);
    if (b) b.addEventListener('click', toggleTheme);
  });

  /* ── 드로어 ──────────────────────────────────────────────────────── */
  var scrim = $('#scrim');
  var burger = $('#drawerToggle');
  var drawerOpen = false;

  function setDrawer(next) {
    drawerOpen = next;
    side.classList.toggle('is-open', next);
    if (next) {
      scrim.hidden = false;
      requestAnimationFrame(function () { scrim.classList.add('is-on'); });
    } else {
      scrim.classList.remove('is-on');
      setTimeout(function () { if (!drawerOpen) scrim.hidden = true; }, 360);
    }
    burger.setAttribute('aria-expanded', String(next));
    burger.setAttribute('aria-label', next ? '메뉴 닫기' : '메뉴 열기');
    document.body.style.overflow = next ? 'hidden' : '';
  }

  if (burger && scrim && side) {
    burger.addEventListener('click', function () { setDrawer(!drawerOpen); });
    scrim.addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerOpen) { setDrawer(false); burger.focus(); }
    });
    global.addEventListener('resize', function () {
      if (drawerOpen && global.innerWidth >= 1024) setDrawer(false);
    });
  }

  /* ── 리빌 ────────────────────────────────────────────────────────── */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: .05, rootMargin: '0px 0px -2% 0px' });

  function observeReveals(scope) {
    (scope || document).querySelectorAll('.reveal:not(.is-in)').forEach(function (n) { io.observe(n); });
  }
  observeReveals();

  /* ── 고지 탭 ─────────────────────────────────────────────────────── */
  (function legalTabs() {
    var btns = Array.prototype.slice.call(document.querySelectorAll('.tabs__btn'));
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) {
          var on = (x === b);
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-selected', String(on));
        });
        document.querySelectorAll('[data-panel]').forEach(function (p) {
          p.hidden = (p.dataset.panel !== b.dataset.tab);
        });
      });
    });
  })();

  /* ── 계산 원리: 검증표 ───────────────────────────────────────────
   * 숫자를 하드코딩하지 않고 실제로 계산한다. 엔진이 틀어지면 여기서 먼저 드러난다.
   * ------------------------------------------------------------- */
  (function verifyTable() {
    var box = $('#verifyTable');
    if (!box) return;

    var cases = [
      { label: '2024 입춘', y: 2024, m: 2, d: 4, lon: 315, official: '02-04 17:27' },
      { label: '2025 입춘', y: 2025, m: 2, d: 3, lon: 315, official: '02-03 23:10' },
      { label: '2026 입춘', y: 2026, m: 2, d: 4, lon: 315, official: '02-04 05:02' },
      { label: '2024 춘분', y: 2024, m: 3, d: 20, lon: 0, official: '03-20 12:06' },
      { label: '2024 하지', y: 2024, m: 6, d: 21, lon: 90, official: '06-21 05:51' },
      { label: '2024 동지', y: 2024, m: 12, d: 21, lon: 270, official: '12-21 18:21' },
    ];
    var pad = function (n) { return String(n).padStart(2, '0'); };

    var html = '<div class="verify__row verify__row--head">' +
      '<span>절기</span><span>계산</span><span>공표</span><span>차</span></div>';

    cases.forEach(function (c) {
      var jd = A.findSolarTermJD(A.toJD(c.y, c.m, c.d), c.lon);
      var t = A.fromJD(jd + 9 / 24);
      var mine = pad(t.m) + '-' + pad(t.d) + ' ' + pad(t.hour) + ':' + pad(t.minute);

      var op = c.official.split(' ');
      var od = op[0].split('-').map(Number);
      var ot = op[1].split(':').map(Number);
      var officialJD = A.toJD(c.y, od[0], od[1]) + (ot[0] + ot[1] / 60) / 24 - 9 / 24;
      var diff = Math.round((jd - officialJD) * 1440);

      html += '<div class="verify__row"><span>' + c.label + '</span>' +
        '<span><b>' + mine + '</b></span><span>' + c.official + '</span>' +
        '<span>' + (diff > 0 ? '+' : '') + diff + '분</span></div>';
    });

    box.innerHTML = html;
  })();

  /* ── 로그인 영역 ─────────────────────────────────────────────────
   * firebase-config.js 가 비어 있으면 이 영역 자체가 나타나지 않는다.
   * ------------------------------------------------------------- */
  var Auth = global.LuneAuth;
  if (Auth) {
    Auth.onChange(function (s) {
      /* 개인정보처리방침 — 백엔드가 아직 안 붙었으면 그 사실을 위에 밝힌다 */
      var note = $('#privacyBackendNote');
      if (note) {
        note.hidden = s.configured;
        if (!s.configured) {
          note.textContent = '현재 이 사이트는 백엔드가 연결되어 있지 않습니다. ' +
            '로그인 기능이 꺼져 있어 아래 항목 중 서버 저장·방문 집계에 해당하는 내용은 ' +
            '아직 적용되지 않으며, 모든 값은 브라우저 안에만 남습니다.';
        }
      }

      var slot = $('#authSlot');
      if (!slot) return;

      if (!s.configured) { slot.hidden = true; renderNav(false); return; }
      slot.hidden = false;
      renderNav(!!(s.user && s.user.isAdmin));

      if (!s.ready) {
        slot.innerHTML = '<p class="authbox__wait micro">로그인 확인 중…</p>';
        return;
      }

      if (!s.user) {
        slot.innerHTML =
          '<button class="authbox__btn" id="signInBtn" type="button">' +
            '<svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">' +
              '<path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 01-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/>' +
              '<path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 009 18z"/>' +
              '<path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 010-3.4V5H.9a9 9 0 000 8l3-2.3z"/>' +
              '<path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 00.9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/>' +
            '</svg>' +
            '<span>구글로 로그인</span>' +
          '</button>' +
          (s.error ? '<p class="authbox__err">' + s.error + '</p>' : '') +
          '<p class="authbox__note">로그인하면 입력한 명식을 계정에 저장해 다른 기기에서도 불러올 수 있습니다.</p>';
        var btn = $('#signInBtn');
        if (btn) btn.addEventListener('click', function () { Auth.signIn(); });
        return;
      }

      var u = s.user;
      slot.innerHTML =
        '<div class="authbox__me">' +
          (u.photoURL
            ? '<img class="authbox__avatar" src="' + u.photoURL + '" alt="" referrerpolicy="no-referrer">'
            : '<span class="authbox__avatar authbox__avatar--blank" aria-hidden="true"></span>') +
          '<div class="authbox__id">' +
            '<b>' + u.displayName + '</b>' +
            (u.isAdmin ? '<span class="authbox__badge">관리자</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="authbox__out" id="signOutBtn" type="button">로그아웃</button>';
      var out = $('#signOutBtn');
      if (out) out.addEventListener('click', function () { Auth.signOut(); });
    });
  }

  global.LuneLayout = {
    page: PAGE,
    observeReveals: observeReveals,
    setTheme: setTheme,
    todayPillar: todayPillar,
  };
})(window);
