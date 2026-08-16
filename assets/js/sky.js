/* =========================================================================
 * sky.js — 배경 캔버스 (별 · 궤도 · 오행 물듦)
 *
 * 제약이 먼저다. 이 배경은 A1(시인성)을 훼손하면 안 된다.
 *   · 별·궤도의 최대 알파를 낮게 묶어 배경 휘도 변화를 0.02 이하로 유지
 *   · prefers-reduced-motion 이면 한 프레임만 그리고 정지
 *   · 탭이 가려지면 rAF 중단
 *   · devicePixelRatio 상한 2, 리사이즈는 디바운스
 *
 * window.LuneSky 로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext) { global.LuneSky = { refresh: function () {}, setTint: function () {} }; return; }

  var ctx = canvas.getContext('2d');
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1;
  var stars = [];
  var rafId = null;
  var scrollY = 0;
  var tint = null;      // {r,g,b}
  var tintFade = 0;     // 0 → 1 로 서서히 물든다
  var ink = { r: 22, g: 21, b: 15 };

  /* 최대 알파 — 이 값을 올리면 본문 대비가 흔들린다. 함부로 키우지 말 것 */
  var STAR_ALPHA = 0.20;
  var ARC_ALPHA = 0.055;
  var TINT_ALPHA = 0.05;

  /* ── 색 읽기 ─────────────────────────────────────────────────────── */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function toRGB(value) {
    var hex = value.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      var n = parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var m = value.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 22, g: 21, b: 15 };
  }
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }

  /* ── 별밭 ────────────────────────────────────────────────────────── */
  function seedStars() {
    // 화면 넓이에 따라 밀도를 맞춘다. 모바일에서 과하게 많지 않도록
    var count = Math.round(Math.min(180, Math.max(70, (W * H) / 11000)));
    stars = [];
    for (var i = 0; i < count; i++) {
      // 결정적 의사난수 — 리사이즈마다 별이 튀지 않도록 인덱스 기반
      var a = Math.sin(i * 12.9898) * 43758.5453;
      var b = Math.sin(i * 78.233) * 24634.6345;
      var c = Math.sin(i * 39.425) * 15731.743;
      stars.push({
        x: a - Math.floor(a),
        y: b - Math.floor(b),
        r: 0.35 + (c - Math.floor(c)) * 1.15,
        depth: 0.25 + (a - Math.floor(a)) * 0.75,
        phase: (b - Math.floor(b)) * Math.PI * 2,
        speed: 0.12 + (c - Math.floor(c)) * 0.34,
      });
    }
  }

  /* ── 크기 ────────────────────────────────────────────────────────── */
  function resize() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    W = global.innerWidth;
    H = global.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars();
    if (reduced) draw(0);
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // 오행 물듦 — 결과를 본 뒤에만 아주 옅게 깔린다
    if (tint && tintFade > 0.001) {
      var g = ctx.createRadialGradient(W * 0.72, H * 0.28, 0, W * 0.72, H * 0.28, Math.max(W, H) * 0.82);
      g.addColorStop(0, rgba(tint, TINT_ALPHA * tintFade));
      g.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 궤도 — 아주 느리게 도는 큰 원. 히어로의 달 모티프를 배경으로 옮긴 것
    var cx = W * 0.5, cy = H * 0.46 - scrollY * 0.04;
    var base = Math.min(W, H) * 0.62;
    ctx.lineWidth = 1;
    for (var k = 0; k < 2; k++) {
      var rot = t * (k === 0 ? 0.000018 : -0.000011);
      var rad = base * (k === 0 ? 1 : 0.72);
      ctx.strokeStyle = rgba(ink, ARC_ALPHA * (k === 0 ? 1 : 0.72));
      ctx.beginPath();
      // 완전한 원이 아니라 살짝 끊긴 호 — 도는 것이 보이도록
      ctx.arc(cx, cy, rad, rot, rot + Math.PI * 1.86);
      ctx.stroke();
    }

    // 별
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var y = s.y * H - scrollY * s.depth * 0.16;
      // 화면 밖으로 나가면 위아래로 되돌려 무한히 이어지게
      y = ((y % H) + H) % H;
      var pulse = 0.55 + 0.45 * Math.sin(t * 0.001 * s.speed + s.phase);
      ctx.fillStyle = rgba(ink, STAR_ALPHA * pulse * s.depth);
      ctx.beginPath();
      ctx.arc(s.x * W, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── 루프 ────────────────────────────────────────────────────────── */
  function loop(t) {
    if (tint && tintFade < 1) tintFade = Math.min(1, tintFade + 0.006);
    draw(t);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (reduced || rafId !== null || document.hidden) return;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ── 배선 ────────────────────────────────────────────────────────── */
  var resizeTimer = null;
  global.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 160);
  });

  global.addEventListener('scroll', function () { scrollY = global.scrollY || 0; }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  function refresh() {
    ink = toRGB(cssVar('--ink'));
    if (reduced) draw(0);
  }

  global.LuneSky = {
    refresh: refresh,
    /** 오행 키('wood' 등)를 받아 배경을 그 색으로 아주 옅게 물들인다 */
    setTint: function (elementKey) {
      if (!elementKey) { tint = null; tintFade = 0; return; }
      tint = toRGB(cssVar('--' + elementKey));
      tintFade = 0;
      if (reduced) { tintFade = 1; draw(0); }
    },
    stop: stop,
    start: start,
  };

  refresh();
  resize();
  start();
})(window);
