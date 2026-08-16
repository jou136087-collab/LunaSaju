/* =========================================================================
 * birthform.js — 출생 정보 입력 폼 (명식 1개 · 궁합 2개에서 공용)
 * 의존: datefield.js, data.js
 * window.LuneBirthForm 으로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var D = global.SajuData;
  var F = global.LuneFields;
  var DEFAULT_LON = 126.978; // 서울
  var DEFAULT_CITY = '서울';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* opts
   *   location  : 태어난 곳 셀렉트를 보일지 (기본 true)
   *   solar     : 진태양시 보정 체크박스를 보일지 (기본 true)
   *   hourChips : 자시~해시 빠른 선택 칩을 보일지 (기본 true)
   * 끄면 서울(동경 126.98°) · 진태양시 보정 켬으로 고정한다.
   * 결과에는 assumedLocation 플래그가 실려, 화면에 "서울 기준"임을 밝힐 수 있다. */
  function create(formEl, opts) {
    opts = opts || {};
    var showLocation = opts.location !== false;
    var showSolar = opts.solar !== false;
    var showChips = opts.hourChips !== false;

    var uid = formEl.id || ('bf' + Math.floor(performance.now()));
    var grid = formEl.querySelector('.form__grid');
    var listeners = [];

    grid.innerHTML =
      /* 생년월일 */
      '<div class="field field--wide">' +
        '<label class="field__label" for="' + uid + '-date">생년월일 <span>양력 · 여덟 자리를 그대로 입력하세요</span></label>' +
        '<div class="datefield">' +
          '<input class="field__input" type="text" id="' + uid + '-date">' +
          '<button class="datefield__btn" type="button" aria-label="달력에서 고르기">' +
            '<svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
              '<rect x="1.5" y="3" width="15" height="13.5" rx="1.5" stroke="currentColor"/>' +
              '<path d="M1.5 7h15M5.5 1.5V4M12.5 1.5V4" stroke="currentColor"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<span class="field__error" id="' + uid + '-date-err" aria-live="polite"></span>' +
      '</div>' +

      /* 시각 */
      '<div class="field">' +
        '<label class="field__label" for="' + uid + '-time">태어난 시각 <span>24시간제</span></label>' +
        '<input class="field__input" type="text" id="' + uid + '-time">' +
        '<span class="field__error" id="' + uid + '-time-err" aria-live="polite"></span>' +
        (showChips ? '<div class="hourchips" id="' + uid + '-chips"></div>' : '') +
        '<label class="check">' +
          '<input type="checkbox" id="' + uid + '-unknown">' +
          '<span>시각을 모릅니다 <em>(시주 제외)</em></span>' +
        '</label>' +
      '</div>' +

      /* 성별 */
      '<div class="field">' +
        '<label class="field__label">성별 <span>대운의 진행 방향 판정에 씁니다</span></label>' +
        '<div class="seg" role="radiogroup" aria-label="성별">' +
          '<button type="button" class="seg__btn is-on" data-gender="M" role="radio" aria-checked="true">남</button>' +
          '<button type="button" class="seg__btn" data-gender="F" role="radio" aria-checked="false">여</button>' +
        '</div>' +
      '</div>' +

      /* 출생지 */
      (showLocation
        ? '<div class="field">' +
            '<label class="field__label" for="' + uid + '-city">태어난 곳 <span>경도로 진태양시를 보정합니다</span></label>' +
            '<select class="field__input" id="' + uid + '-city"></select>' +
          '</div>'
        : '') +

      /* 시간 보정 */
      (showSolar
        ? '<div class="field">' +
            '<label class="field__label">시간 보정</label>' +
            '<label class="check">' +
              '<input type="checkbox" id="' + uid + '-solar" checked>' +
              '<span>진태양시로 보정 <em id="' + uid + '-corr">—</em></span>' +
            '</label>' +
          '</div>'
        : '');

    var $ = function (sel) { return formEl.querySelector(sel); };

    var dateCtl = F.enhanceDate($('#' + uid + '-date'), { errorEl: $('#' + uid + '-date-err') });
    var timeCtl = F.enhanceTime($('#' + uid + '-time'), { errorEl: $('#' + uid + '-time-err') });
    var chipsEl = showChips ? $('#' + uid + '-chips') : null;
    if (chipsEl) F.buildHourChips(chipsEl, timeCtl);

    var unknownEl = $('#' + uid + '-unknown');
    var solarEl = showSolar ? $('#' + uid + '-solar') : null;
    var citySel = showLocation ? $('#' + uid + '-city') : null;
    var corrEl = showSolar ? $('#' + uid + '-corr') : null;
    var gender = 'M';

    if (citySel) {
      D.CITIES.forEach(function (c) {
        var o = el('option');
        o.value = String(c.lon);
        o.textContent = c.name;
        citySel.appendChild(o);
      });
      citySel.value = String(DEFAULT_LON);
    }

    /* 필드를 감춘 경우의 고정값 */
    function currentLon() { return citySel ? parseFloat(citySel.value) : DEFAULT_LON; }
    function currentCity() {
      return citySel ? citySel.options[citySel.selectedIndex].textContent : DEFAULT_CITY;
    }
    function currentSolar() { return solarEl ? solarEl.checked : true; }

    formEl.querySelectorAll('.seg__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        formEl.querySelectorAll('.seg__btn').forEach(function (x) {
          x.classList.remove('is-on');
          x.setAttribute('aria-checked', 'false');
        });
        b.classList.add('is-on');
        b.setAttribute('aria-checked', 'true');
        gender = b.dataset.gender;
        emit();
      });
    });

    function syncUnknown() {
      var off = unknownEl.checked;
      timeCtl.input.disabled = off;
      timeCtl.input.style.opacity = off ? '.4' : '1';
      if (chipsEl) {
        chipsEl.style.opacity = off ? '.4' : '1';
        chipsEl.querySelectorAll('.hourchip').forEach(function (c) { c.disabled = off; });
      }
      if (off) timeCtl.showError('');
    }

    function updateCorr() {
      if (!corrEl) return;
      var minutes = Math.round((currentLon() - 135) * 4);
      corrEl.textContent = currentSolar()
        ? '(' + (minutes >= 0 ? '+' : '−') + Math.abs(minutes) + '분)'
        : '(표준시 그대로)';
    }

    function emit() { listeners.forEach(function (fn) { fn(); }); }

    unknownEl.addEventListener('change', function () { syncUnknown(); emit(); });
    if (solarEl) solarEl.addEventListener('change', function () { updateCorr(); emit(); });
    if (citySel) citySel.addEventListener('change', function () { updateCorr(); emit(); });
    dateCtl.onChange(emit);
    timeCtl.onChange(emit);

    syncUnknown();
    updateCorr();

    /* ── 읽기 ────────────────────────────────────────────────────────
     * 유효하면 computeChart 에 그대로 넘길 수 있는 객체, 아니면 null.
     * null 일 때는 문제가 된 필드에 오류를 표시하고 포커스를 옮긴다.
     * -------------------------------------------------------------- */
    function read(opt) {
      opt = opt || {};
      var date = dateCtl.get();
      if (!date) {
        var why = dateCtl.reason() || '생년월일을 입력해 주세요';
        dateCtl.showError(why);
        if (!opt.silent) dateCtl.focus();
        return null;
      }

      var unknown = unknownEl.checked;
      var time = { hour: 12, minute: 0 };
      if (!unknown) {
        var t = timeCtl.get();
        if (!t) {
          var w = timeCtl.reason() || '시각을 입력하거나 "시각을 모릅니다"를 선택해 주세요';
          timeCtl.showError(w);
          if (!opt.silent) timeCtl.focus();
          return null;
        }
        time = t;
      }

      return {
        year: date.y, month: date.m, day: date.d,
        hour: time.hour, minute: time.minute,
        gender: gender,
        lon: currentLon(),
        cityName: currentCity(),
        useSolarTime: currentSolar(),
        unknownTime: unknown,
        // 출생지를 묻지 않은 폼이라는 표시. 결과 화면이 이를 밝혀야 한다.
        assumedLocation: !showLocation,
      };
    }

    /* ── 채우기 ─────────────────────────────────────────────────────── */
    function fill(v) {
      if (!v) return;
      if (v.year) dateCtl.set({ y: v.year, m: v.month, d: v.day });
      if (v.unknownTime) {
        unknownEl.checked = true;
      } else if (v.hour != null) {
        unknownEl.checked = false;
        timeCtl.set({ hour: v.hour, minute: v.minute || 0 });
      }
      if (v.gender) {
        gender = (String(v.gender).toUpperCase() === 'F') ? 'F' : 'M';
        formEl.querySelectorAll('.seg__btn').forEach(function (b) {
          var on = b.dataset.gender === gender;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-checked', String(on));
        });
      }
      if (citySel) {
        if (v.cityName) {
          var hit = D.CITIES.filter(function (c) { return c.name === v.cityName; })[0];
          if (hit) citySel.value = String(hit.lon);
        } else if (v.lon != null) {
          citySel.value = String(v.lon);
        }
      }
      if (solarEl && v.useSolarTime != null) solarEl.checked = !!v.useSolarTime;
      syncUnknown();
      updateCorr();
      emit();
    }

    return {
      el: formEl,
      read: read,
      fill: fill,
      /** 아직 아무것도 입력되지 않았는가 — 사용자가 친 값을 덮어쓰지 않기 위해 쓴다 */
      isPristine: function () { return !/\d/.test(dateCtl.input.value); },
      onChange: function (fn) { listeners.push(fn); },
      focusFirst: function () { dateCtl.focus(); },
    };
  }

  global.LuneBirthForm = { create: create };
})(window);
