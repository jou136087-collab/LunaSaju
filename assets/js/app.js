/* =========================================================================
 * app.js — 명식 페이지 (입력 · 산출 · 렌더). index.html 에서만 로드한다.
 * 셸(사이드바·상단바·푸터·테마·리빌)은 layout.js 가 맡는다.
 * ========================================================================= */
(function (global) {
  'use strict';

  var D = global.SajuData, S = global.Saju;
  var Store = global.LuneStore;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var elClass = function (key) { return 'el-' + key; };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var formEl = $('#sajuForm');
  // 명식 화면은 입력을 최소로 둔다 — 출생지·시간 보정·지시 칩을 감추고 서울 기준으로 고정.
  // 감췄다는 사실은 결과 메타에 그대로 밝힌다(assumedLocation).
  var form = global.LuneBirthForm.create(formEl, {
    location: false,
    solar: false,
    hourChips: false,
  });
  var resultEl = $('#result');
  var rememberEl = $('#rememberMe');
  var recallBtn = formEl.querySelector('[data-recall]');
  var lastChart = null;

  /* ── 저장된 정보 ─────────────────────────────────────────────────── */
  function syncRecall() {
    var has = Store.hasProfile();
    recallBtn.hidden = !has;
    if (has) rememberEl.checked = true;
  }
  recallBtn.addEventListener('click', function () {
    var p = Store.getProfile();
    if (p) { form.fill(p); formEl.requestSubmit ? formEl.requestSubmit() : formEl.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  syncRecall();

  /* ── 제출 ────────────────────────────────────────────────────────── */
  formEl.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var input = form.read();
    if (!input) return;

    if (rememberEl.checked) Store.setProfile(input);
    else Store.clearProfile();
    syncRecall();

    var chart = S.computeChart(input);
    lastChart = chart;
    render(chart);

    resultEl.hidden = false;
    requestAnimationFrame(function () {
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  $('#againBtn').addEventListener('click', function () {
    $('#reading').scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.focusFirst();
  });
  $('#printBtn').addEventListener('click', function () { global.print(); });

  /* ── 링크로 미리 채우기 ──────────────────────────────────────────
   * index.html?d=1990-05-12&t=14:30&g=M&unknown=0
   * URL 은 읽기만 하며 입력값을 주소창에 되쓰지 않는다.
   * ------------------------------------------------------------- */
  (function prefill() {
    var q = new URLSearchParams(location.search);
    var d = q.get('d');
    var p = d ? d.split('-').map(Number) : null;

    if (p && p.length === 3 && !p.some(isNaN)) {
      var t = (q.get('t') || '12:00').split(':').map(Number);
      form.fill({
        year: p[0], month: p[1], day: p[2],
        hour: t[0], minute: t[1] || 0,
        gender: q.get('g') || 'M',
        unknownTime: q.get('unknown') === '1',
      });
      formEl.dispatchEvent(new Event('submit', { cancelable: true }));
      return;
    }
    if (Store.hasProfile()) form.fill(Store.getProfile());
  })();

  /* 로그인하면 계정에 저장돼 있던 명식이 내려온다.
   * 사용자가 이미 뭔가 입력했다면 덮어쓰지 않는다. */
  if (global.LuneAuth) {
    global.LuneAuth.onChange(function (s) {
      if (s.user && form.isPristine() && Store.hasProfile()) {
        form.fill(Store.getProfile());
      }
      syncRecall();
    });
  }

  /* =====================================================================
   * 렌더
   * =================================================================== */
  function render(c) {
    renderHeader(c);
    renderPillars(c);
    renderMaster(c);
    renderElements(c);
    renderGods(c);
    renderGauge(c);
    renderLuck(c);
    renderYearLuck(c);

    // 배경을 이 사람의 가장 두터운 오행 색으로 아주 옅게 물들인다
    var top = c.elements.slice().sort(function (x, y) { return y.count - x.count; })[0];
    if (global.LuneSky && top) global.LuneSky.setTint(top.key);
  }

  /* 헤더 · 메타 */
  function renderHeader(c) {
    var i = c.input, m = c.meta;
    var list = [c.pillars.year, c.pillars.month, c.pillars.day];
    if (c.pillars.hour) list.push(c.pillars.hour);

    $('#ganjiLine').textContent = list.map(function (p) { return p.ganji; }).join(' ');
    $('#resultTitle').textContent = c.dayMaster.hanja + '(' + c.dayMaster.ko + ') 일간의 명식';

    var parts = [];
    parts.push(i.year + '년 ' + i.month + '월 ' + i.day + '일' +
      (i.unknownTime ? ' · 시각 미상' : ' ' + pad(i.hour) + ':' + pad(i.minute)) +
      (i.assumedLocation ? '' : ' · ' + (i.cityName || '') + ' 출생'));

    var corr = m.correctionMinutes;
    var corrTxt = i.useSolarTime
      ? (i.assumedLocation
          ? '출생지 미입력 → <b>' + (i.cityName || '서울') + '(동경 126.98°)</b> 기준으로 진태양시 ' +
            (corr >= 0 ? '+' : '−') + Math.abs(corr) + '분 보정 → 명식 기준 시각 ' +
            pad(m.localTime.hour) + ':' + pad(m.localTime.minute)
          : '진태양시 보정 ' + (corr >= 0 ? '+' : '−') + Math.abs(corr) + '분 적용 → 명식 기준 시각 ' +
            pad(m.localTime.hour) + ':' + pad(m.localTime.minute))
      : '표준시 그대로 사용';
    if (m.dst) corrTxt += ' · 서머타임 시행 기간(−1시간) 반영';
    if (m.standardOffset !== 9) corrTxt += ' · 당시 표준자오선 동경 127.5°(UTC+8:30) 반영';
    if (m.lateZi) corrTxt += ' · 야자시로 일주를 다음 날로 넘김';
    parts.push(corrTxt);

    parts.push('절기 기준 ' + m.sajuYear + '년 ' + m.termName + '(' + m.termHanja + ') 구간 · ' +
      m.termStart.m + '월 ' + m.termStart.d + '일 ' + pad(m.termStart.hour) + ':' + pad(m.termStart.minute) +
      ' ~ ' + m.termEnd.m + '월 ' + m.termEnd.d + '일 · 다음 절기 ' + m.nextTermName);

    parts.push('공망 ' + c.voidBranches.map(function (b) { return b.hanja + b.ko; }).join('·') +
      ' — 이 두 지지에 해당하는 자리는 기대만큼 손에 남지 않는다고 봅니다.');

    $('#resultMeta').innerHTML = parts.join('<br>');
  }

  /* 네 기둥 */
  function renderPillars(c) {
    var box = $('#pillars');
    box.innerHTML = '';
    box.classList.toggle('pillars--3', !c.pillars.hour);

    var order = [c.pillars.hour, c.pillars.day, c.pillars.month, c.pillars.year];
    var subs = {
      시주: '태어난 시각 · 말년/자녀',
      일주: '나 자신 · 배우자',
      월주: '사회 · 부모/직업',
      년주: '뿌리 · 조상/초년',
    };

    order.forEach(function (p, k) {
      if (!p) return;
      var n = el('div', 'pillar' + (p.label === '일주' ? ' pillar--day' : ''));
      n.style.setProperty('--d', (k * 0.09) + 's');

      n.appendChild(el('div', 'pillar__head',
        '<span class="pillar__label">' + p.label + '</span>' +
        '<span class="pillar__sub">' + (subs[p.label] || '') + '</span>'));

      n.appendChild(el('div', 'glyph',
        '<span class="glyph__god">' + (p.label === '일주' ? '일간 · 나' : p.stemGod) + '</span>' +
        '<span class="glyph__char ' + elClass(p.stem.element) + '">' + p.stem.hanja + '</span>' +
        '<span class="glyph__ko">' + p.stem.ko + ' · ' + D.ELEMENTS[p.stem.element].ko +
        (p.stem.yin ? '(음)' : '(양)') + '</span>'));

      n.appendChild(el('div', 'glyph__rule'));

      n.appendChild(el('div', 'glyph',
        '<span class="glyph__char ' + elClass(p.branch.element) + '">' + p.branch.hanja + '</span>' +
        '<span class="glyph__ko">' + p.branch.ko + ' · ' + p.branch.animal + '</span>' +
        '<span class="glyph__god" style="display:block;margin-top:.3rem">' + p.branchGod + '</span>'));

      n.appendChild(el('div', 'pillar__hidden',
        '<b>지장간</b>' + p.hidden.map(function (s) {
          return '<span class="' + elClass(s.element) + '">' + s.hanja + '</span>';
        }).join('')));

      n.appendChild(el('div', 'pillar__stage', '십이운성 · ' + p.stage));
      box.appendChild(n);
    });
  }

  /* 일간 카드 */
  function renderMaster(c) {
    var dm = c.dayMaster;
    var info = D.DAY_MASTER[dm.hanja];
    $('#masterCard').innerHTML =
      '<div class="master__glyph">' +
        '<span class="cap">일간 · 나</span>' +
        '<span class="big ' + elClass(dm.element) + '">' + dm.hanja + '</span>' +
        '<span class="cap">' + dm.ko + ' · ' + D.ELEMENTS[dm.element].ko + (dm.yin ? '음' : '양') + '</span>' +
      '</div>' +
      '<div>' +
        '<span class="micro">일간 · ' + info.title + '</span>' +
        '<p class="master__line">' + info.line + '</p>' +
        '<p class="master__body">' + info.body + '</p>' +
        '<div class="tags">' + info.keywords.map(function (k) {
          return '<span class="tag">' + k + '</span>';
        }).join('') + '</div>' +
      '</div>';
  }

  /* 막대 하나 그리기 */
  function drawBar(box, opts, i) {
    var row = el('div', 'bar' + (opts.count === 0 ? ' bar--empty' : ''));
    row.innerHTML =
      '<span class="bar__name ' + (opts.colorClass || '') + '">' +
        '<b>' + opts.label + '</b><i>' + opts.sub + '</i></span>' +
      '<span class="bar__track"><span class="bar__fill" style="background:' + opts.color +
        ';--d:' + (i * .08) + 's"></span></span>' +
      '<span class="bar__val">' + opts.count + '</span>';
    box.appendChild(row);
    var fill = row.querySelector('.bar__fill');
    requestAnimationFrame(function () { fill.style.width = opts.pct + '%'; });
  }

  /* 오행 */
  function renderElements(c) {
    var box = $('#elementBars');
    box.innerHTML = '';
    var max = Math.max.apply(null, c.elements.map(function (e) { return e.count; }));

    c.elements.forEach(function (e, i) {
      drawBar(box, {
        label: e.hanja, sub: e.ko, count: e.count,
        pct: max ? (e.count / max) * 100 : 0,
        color: 'var(--' + e.key + ')',
        colorClass: elClass(e.key),
      }, i);
    });

    var sorted = c.elements.slice().sort(function (a, b) { return b.count - a.count; });
    var top = sorted[0];
    var zeros = c.elements.filter(function (e) { return e.count === 0; });

    var txt = '<b>' + top.hanja + '(' + top.ko + ')</b> 기운이 가장 두텁습니다. ' + D.ELEMENT_NOTE[top.key].many;
    if (zeros.length) {
      txt += ' 반면 ' + zeros.map(function (z) { return z.hanja + '(' + z.ko + ')'; }).join('·') +
        ' 기운은 원국에 드러나 있지 않습니다. ' + D.ELEMENT_NOTE[zeros[0].key].few;
    } else {
      var low = sorted[sorted.length - 1];
      txt += ' 가장 옅은 것은 ' + low.hanja + '(' + low.ko + ')입니다. ' + D.ELEMENT_NOTE[low.key].few;
    }
    $('#elementNote').innerHTML = txt;
  }

  /* 십성 */
  function renderGods(c) {
    var box = $('#godBars');
    box.innerHTML = '';
    var max = Math.max.apply(null, c.godGroups.map(function (g) { return g.count; }));
    var labels = { 비겁: '나·경쟁', 식상: '표현·생산', 재성: '결과·재물', 관성: '책임·규율', 인성: '학습·보호' };

    c.godGroups.forEach(function (g, i) {
      drawBar(box, {
        label: g.key, sub: labels[g.key], count: g.count,
        pct: max ? (g.count / max) * 100 : 0,
        color: 'var(--ink)',
      }, i);
    });

    var top = c.godGroups.slice().sort(function (a, b) { return b.count - a.count; })[0];
    var note = D.GOD_GROUP_NOTE[top.key];
    var absent = c.godGroups.filter(function (g) { return g.count === 0; }).map(function (g) { return g.key; });

    var txt = '<b>' + note.title + '</b> — ' + note.body;
    if (absent.length) {
      txt += ' 원국에 ' + absent.join('·') + '이 보이지 않으니, 그 영역은 타고난 기본값이 아니라 ' +
        '의식적으로 만들어 붙여야 하는 근육이라고 보면 됩니다.';
    }
    $('#godNote').innerHTML = txt;
  }

  /* 게이지 */
  function renderGauge(c) {
    var pct = Math.round(c.strength * 100);
    requestAnimationFrame(function () { $('#gaugeFill').style.width = pct + '%'; });

    var txt;
    if (c.strength >= 0.62) {
      txt = '일간을 돕는 기운이 <b>' + pct + '%</b>로 넉넉합니다. 스스로 밀고 나가는 힘이 강하니, ' +
            '기운을 쓰는 쪽—표현하고, 만들고, 책임지는 일—으로 흘려보낼 때 균형이 잡힙니다. ' +
            '가만히 쌓아두면 답답함이 먼저 옵니다.';
    } else if (c.strength >= 0.45) {
      txt = '돕는 기운과 쓰는 기운이 <b>' + pct + '% : ' + (100 - pct) + '%</b>로 비교적 고르게 맞물려 있습니다. ' +
            '한쪽으로 치우친 명식보다 상황 적응력이 좋은 대신, 스스로 방향을 정해주지 않으면 ' +
            '주변 흐름에 따라 색이 자주 바뀝니다. 기준을 문장으로 적어두는 습관이 잘 맞습니다.';
    } else {
      txt = '일간을 돕는 기운이 <b>' + pct + '%</b>로 얇은 편입니다. 혼자 다 감당하는 구조보다 ' +
            '배우고 기대고 위임하는 구조에서 성과가 훨씬 커집니다. 사람·자격·시스템처럼 ' +
            '나를 받쳐주는 것에 투자하는 것이 가장 확실한 전략입니다.';
    }
    txt += ' 신강·신약 판정은 유파에 따라 기준이 달라 참고 지표로만 보세요.';
    $('#gaugeNote').innerHTML = txt;
  }

  /* 대운 */
  function renderLuck(c) {
    var strip = $('#luckStrip');
    strip.innerHTML = '';

    c.luckPillars.forEach(function (lp) {
      var isNow = (c.currentLuck && lp === c.currentLuck);
      var n = el('div', 'luck__item' + (isNow ? ' is-now' : ''));
      n.innerHTML =
        '<div class="luck__age">' + lp.age + '세</div>' +
        '<div class="luck__ganji"><span class="' + elClass(lp.stem.element) + '">' + lp.stem.hanja + '</span>' +
        '<span class="' + elClass(lp.branch.element) + '">' + lp.branch.hanja + '</span></div>' +
        '<div class="luck__god">' + lp.stemGod + '<br>' + lp.branchGod + '</div>' +
        (isNow ? '<div class="luck__now">NOW</div>' : '');
      strip.appendChild(n);
      if (isNow) {
        requestAnimationFrame(function () {
          strip.scrollTo({ left: Math.max(0, n.offsetLeft - strip.clientWidth / 2 + n.clientWidth / 2), behavior: 'smooth' });
        });
      }
    });

    $('#luckMeta').innerHTML =
      '대운은 ' + (c.forward ? '<b>순행</b>' : '<b>역행</b>') + '하며, 첫 대운은 <b>' + c.startAge + '세</b>부터 시작합니다. ' +
      '월주에서 ' + (c.forward ? '앞으로' : '거꾸로') + ' 한 칸씩 옮겨간 간지가 각 10년의 배경이 됩니다.';

    if (c.currentLuck) {
      var g = D.TEN_GODS[c.currentLuck.stemGod];
      var grp = g ? g.group : null;
      $('#luckNote').innerHTML =
        '지금은 <b>' + c.currentLuck.age + '세 ' + c.currentLuck.ganji + ' 대운</b> 안에 있습니다. ' +
        (grp && D.LUCK_NOTE[grp] ? D.LUCK_NOTE[grp] : '') +
        ' 나이는 출생연도 기준 세는나이로 계산했습니다.';
    } else {
      $('#luckNote').innerHTML = '아직 첫 대운이 시작되기 전입니다. 이 시기는 원국의 성질이 그대로 드러납니다.';
    }
  }

  /* 세운 */
  function renderYearLuck(c) {
    var yl = c.yearLuck;
    var g = D.TEN_GODS[yl.stemGod];
    var grp = g ? g.group : null;
    $('#yearCard').innerHTML =
      '<div class="master__glyph">' +
        '<span class="cap">' + yl.year + ' 세운</span>' +
        '<span class="big">' + yl.stem.hanja + yl.branch.hanja + '</span>' +
        '<span class="cap">' + yl.stem.ko + yl.branch.ko + '년 · ' + yl.branch.animal + '</span>' +
      '</div>' +
      '<div>' +
        '<span class="micro">올해의 결</span>' +
        '<p class="master__line">' + yl.stemGod + '의 해</p>' +
        '<p class="master__body">' +
          '올해의 천간은 나에게 <b>' + yl.stemGod + '</b>, 지지는 <b>' + yl.branchGod + '</b>으로 작용합니다. ' +
          (grp && D.LUCK_NOTE[grp] ? D.LUCK_NOTE[grp] : '') +
          ' 대운이 10년짜리 계절이라면 세운은 그 안의 한 해 날씨입니다. ' +
          '두 흐름이 같은 방향이면 속도가 붙고, 반대면 조정이 필요한 해가 됩니다.' +
        '</p>' +
      '</div>';
  }

  global.LuneApp = {
    getLastInput: function () { return lastChart ? lastChart.input : null; },
  };
})(window);
