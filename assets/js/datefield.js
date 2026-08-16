/* =========================================================================
 * datefield.js — 생년월일 · 시각 입력 필드
 *
 * 네이티브 <input type="date"> 는 현재 연도에서 시작해 1900년대까지 내려가는 데
 * 클릭이 너무 많이 든다. 그래서 8자리 직접 입력을 기본으로 두고,
 * 연도 드롭다운이 달린 달력 팝오버를 보조로 붙인다.
 *
 * window.LuneFields 로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var THIS_YEAR = new Date().getFullYear();
  var MIN_YEAR = 1900;
  var MAX_YEAR = 2100;
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function pad2(n) { return String(n).padStart(2, '0'); }
  function digitsOf(s) { return (s || '').replace(/\D/g, ''); }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* 포맷 후에도 커서가 같은 자리에 남도록, 커서 앞의 숫자 개수를 기준으로 되돌린다 */
  function restoreCaret(input, digitsBefore) {
    var seen = 0, pos = input.value.length;
    for (var i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i])) {
        seen++;
        if (seen === digitsBefore) { pos = i + 1; break; }
      }
    }
    if (digitsBefore === 0) pos = 0;
    try { input.setSelectionRange(pos, pos); } catch (e) {}
  }

  function countDigitsBeforeCaret(input) {
    var caret = input.selectionStart == null ? input.value.length : input.selectionStart;
    return digitsOf(input.value.slice(0, caret)).length;
  }

  /* =====================================================================
   * 생년월일
   * =================================================================== */
  function enhanceDate(input, opts) {
    opts = opts || {};
    var wrap = input.closest('.datefield');
    var errorEl = opts.errorEl || null;
    var listeners = [];
    var cal = null;
    var open = false;

    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'YYYY . MM . DD';
    input.maxLength = 14;

    function format(d) {
      if (d.length <= 4) return d;
      if (d.length <= 6) return d.slice(0, 4) + ' . ' + d.slice(4);
      return d.slice(0, 4) + ' . ' + d.slice(4, 6) + ' . ' + d.slice(6, 8);
    }

    /** 유효하면 {y,m,d}, 아니면 null. 두 번째 반환값으로 사유를 준다. */
    function parse() {
      var d = digitsOf(input.value);
      if (d.length !== 8) return { value: null, reason: d.length ? '여덟 자리를 모두 채워 주세요' : '' };
      var y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
      if (y < MIN_YEAR || y > MAX_YEAR) return { value: null, reason: MIN_YEAR + '~' + MAX_YEAR + '년만 지원합니다' };
      if (m < 1 || m > 12) return { value: null, reason: '월은 01~12 사이여야 합니다' };
      if (day < 1 || day > daysInMonth(y, m)) {
        return { value: null, reason: y + '년 ' + m + '월은 ' + daysInMonth(y, m) + '일까지입니다' };
      }
      return { value: { y: y, m: m, d: day }, reason: '' };
    }

    function showError(msg) {
      if (errorEl) errorEl.textContent = msg || '';
      input.classList.toggle('is-error', !!msg);
    }

    function emit() { listeners.forEach(function (fn) { fn(parse().value); }); }

    input.addEventListener('input', function () {
      var before = countDigitsBeforeCaret(input);
      var d = digitsOf(input.value).slice(0, 8);
      input.value = format(d);
      restoreCaret(input, before);
      showError('');
      if (d.length === 8) {
        var p = parse();
        if (!p.value) showError(p.reason);
      }
      emit();
    });

    input.addEventListener('blur', function () {
      var p = parse();
      if (digitsOf(input.value).length && !p.value) showError(p.reason);
    });

    /* ── 달력 팝오버 ─────────────────────────────────────────────── */
    function buildCal() {
      cal = el('div', 'cal');
      cal.hidden = true;

      var head = el('div', 'cal__head');
      var ySel = el('select', 'cal__select');
      ySel.setAttribute('aria-label', '연도');
      for (var y = MAX_YEAR; y >= MIN_YEAR; y--) {
        var o = el('option'); o.value = String(y); o.textContent = y + '년';
        ySel.appendChild(o);
      }
      var mSel = el('select', 'cal__select');
      mSel.setAttribute('aria-label', '월');
      for (var m = 1; m <= 12; m++) {
        var om = el('option'); om.value = String(m); om.textContent = m + '월';
        mSel.appendChild(om);
      }
      var prev = el('button', 'cal__nav', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', '이전 달');
      var next = el('button', 'cal__nav', '›'); next.type = 'button'; next.setAttribute('aria-label', '다음 달');
      head.append(prev, ySel, mSel, next);

      var dow = el('div', 'cal__dow');
      DOW.forEach(function (d) { dow.appendChild(el('span', null, d)); });

      var grid = el('div', 'cal__grid');
      cal.append(head, dow, grid);
      wrap.appendChild(cal);

      function shift(delta) {
        var m = +mSel.value + delta, y = +ySel.value;
        if (m < 1) { m = 12; y--; }
        if (m > 12) { m = 1; y++; }
        if (y < MIN_YEAR || y > MAX_YEAR) return;
        ySel.value = String(y); mSel.value = String(m);
        draw();
      }
      prev.addEventListener('click', function () { shift(-1); });
      next.addEventListener('click', function () { shift(1); });
      ySel.addEventListener('change', draw);
      mSel.addEventListener('change', draw);

      function draw() {
        var y = +ySel.value, m = +mSel.value;
        var cur = parse().value;
        grid.innerHTML = '';
        var lead = new Date(y, m - 1, 1).getDay();
        for (var i = 0; i < lead; i++) {
          var blank = el('button', 'cal__day is-empty');
          blank.type = 'button'; blank.tabIndex = -1;
          grid.appendChild(blank);
        }
        for (var d = 1; d <= daysInMonth(y, m); d++) {
          var b = el('button', 'cal__day', String(d));
          b.type = 'button';
          if (cur && cur.y === y && cur.m === m && cur.d === d) b.classList.add('is-on');
          b.dataset.day = String(d);
          grid.appendChild(b);
        }
      }

      grid.addEventListener('click', function (ev) {
        var b = ev.target.closest('.cal__day');
        if (!b || b.classList.contains('is-empty')) return;
        set({ y: +ySel.value, m: +mSel.value, d: +b.dataset.day });
        toggle(false);
        input.focus();
      });

      cal._sync = function () {
        var cur = parse().value;
        ySel.value = String(cur ? cur.y : 1990);
        mSel.value = String(cur ? cur.m : 1);
        draw();
      };
    }

    function toggle(next) {
      if (!cal) buildCal();
      open = (next === undefined) ? !open : next;
      if (open) cal._sync();
      cal.hidden = !open;
      if (wrap) {
        var btn = wrap.querySelector('.datefield__btn');
        if (btn) btn.setAttribute('aria-expanded', String(open));
      }
    }

    if (wrap) {
      var btn = wrap.querySelector('.datefield__btn');
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(); });
      }
      document.addEventListener('click', function (ev) {
        if (open && !wrap.contains(ev.target)) toggle(false);
      });
      document.addEventListener('keydown', function (ev) {
        if (open && ev.key === 'Escape') { toggle(false); input.focus(); }
      });
    }

    function set(v) {
      if (!v) { input.value = ''; showError(''); emit(); return; }
      input.value = format('' + v.y + pad2(v.m) + pad2(v.d));
      showError('');
      emit();
    }

    return {
      get: function () { return parse().value; },
      reason: function () { return parse().reason; },
      set: set,
      showError: showError,
      focus: function () { input.focus(); },
      onChange: function (fn) { listeners.push(fn); },
      input: input,
    };
  }

  /* =====================================================================
   * 시각
   * =================================================================== */
  function enhanceTime(input, opts) {
    opts = opts || {};
    var listeners = [];
    var errorEl = opts.errorEl || null;

    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'HH : MM';
    input.maxLength = 7;

    function format(d) {
      if (d.length <= 2) return d;
      return d.slice(0, 2) + ' : ' + d.slice(2, 4);
    }

    function parse() {
      var d = digitsOf(input.value);
      if (d.length !== 4) return { value: null, reason: d.length ? '네 자리를 모두 채워 주세요' : '' };
      var h = +d.slice(0, 2), m = +d.slice(2, 4);
      if (h > 23) return { value: null, reason: '시는 00~23 사이여야 합니다' };
      if (m > 59) return { value: null, reason: '분은 00~59 사이여야 합니다' };
      return { value: { hour: h, minute: m }, reason: '' };
    }

    function showError(msg) {
      if (errorEl) errorEl.textContent = msg || '';
      input.classList.toggle('is-error', !!msg);
    }

    function emit() { listeners.forEach(function (fn) { fn(parse().value); }); }

    input.addEventListener('input', function () {
      var before = countDigitsBeforeCaret(input);
      var d = digitsOf(input.value).slice(0, 4);
      input.value = format(d);
      restoreCaret(input, before);
      showError('');
      if (d.length === 4) {
        var p = parse();
        if (!p.value) showError(p.reason);
      }
      emit();
    });

    input.addEventListener('blur', function () {
      var p = parse();
      if (digitsOf(input.value).length && !p.value) showError(p.reason);
    });

    function set(v) {
      if (!v) { input.value = ''; showError(''); emit(); return; }
      input.value = format(pad2(v.hour) + pad2(v.minute));
      showError('');
      emit();
    }

    return {
      get: function () { return parse().value; },
      reason: function () { return parse().reason; },
      set: set,
      showError: showError,
      focus: function () { input.focus(); },
      onChange: function (fn) { listeners.push(fn); },
      input: input,
    };
  }

  /* =====================================================================
   * 12지시 빠른 선택
   * "새벽 3시쯤" 만 아는 사람을 위한 경로. 각 지지 구간의 한가운데를 넣는다.
   * 표시 구간(23:30~01:30 …)은 한국 만세력의 관례 표기로, 서울 기준
   * 진태양시 보정 약 30분이 이미 반영된 값이다.
   * =================================================================== */
  function buildHourChips(container, timeCtl) {
    var branches = global.SajuData.BRANCHES;
    var chips = [];

    branches.forEach(function (b) {
      var start = b.hour.split('–')[0].split(':').map(Number);
      var mid = (start[0] * 60 + start[1] + 60) % 1440;   // 구간 시작 + 1시간 = 한가운데
      var chip = el('button', 'hourchip', b.ko + '시');
      chip.type = 'button';
      chip.title = b.ko + '시 (' + b.hour + ') · ' + b.animal;
      chip.dataset.h = String(Math.floor(mid / 60));
      chip.dataset.m = String(mid % 60);
      chip.addEventListener('click', function () {
        timeCtl.set({ hour: +chip.dataset.h, minute: +chip.dataset.m });
        mark(chip);
      });
      container.appendChild(chip);
      chips.push(chip);
    });

    function mark(active) {
      chips.forEach(function (c) { c.classList.toggle('is-on', c === active); });
    }
    // 직접 입력하면 칩 선택 표시를 푼다
    timeCtl.input.addEventListener('input', function () { mark(null); });

    return { clear: function () { mark(null); } };
  }

  global.LuneFields = {
    enhanceDate: enhanceDate,
    enhanceTime: enhanceTime,
    buildHourChips: buildHourChips,
    daysInMonth: daysInMonth,
    pad2: pad2,
  };
})(window);
