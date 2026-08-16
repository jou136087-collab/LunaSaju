/* =========================================================================
 * couple.js — 커플 궁합 뷰 (입력 2개 · 판정 · 렌더)
 * 판정 규칙과 배점은 compat.js 에 있다. 여기서는 보여주기만 한다.
 * ========================================================================= */
(function (global) {
  'use strict';

  var S = global.Saju, C = global.LuneCompat;
  var Store = global.LuneStore;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  var formA = global.LuneBirthForm.create($('#formA'));
  var formB = global.LuneBirthForm.create($('#formB'));
  var resultEl = $('#compatResult');
  var recallA = $('#formA').querySelector('[data-recall]');
  var last = null;

  /* ── 저장된 내 정보 ──────────────────────────────────────────────── */
  function syncRecall() { recallA.hidden = !Store.hasProfile(); }
  recallA.addEventListener('click', function () { formA.fill(Store.getProfile()); });
  syncRecall();

  /* ── 판정 ────────────────────────────────────────────────────────── */
  $('#compatBtn').addEventListener('click', function () {
    var a = formA.read();
    if (!a) { $('#formA').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var b = formB.read();
    if (!b) { $('#formB').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

    var chartA = S.computeChart(a);
    var chartB = S.computeChart(b);
    last = { a: a, b: b, result: C.compare(chartA, chartB) };

    Store.setPartner(b);
    render(last.result);

    resultEl.hidden = false;
    requestAnimationFrame(function () {
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── 렌더 ────────────────────────────────────────────────────────── */
  function render(r) {
    var ganjiOf = function (c) {
      var l = [c.pillars.year, c.pillars.month, c.pillars.day];
      if (c.pillars.hour) l.push(c.pillars.hour);
      return l.map(function (p) { return p.ganji; }).join(' ');
    };

    $('#compatGanji').innerHTML = 'A ' + ganjiOf(r.a) + ' &nbsp;·&nbsp; B ' + ganjiOf(r.b);
    $('#compatTitle').textContent =
      r.a.dayMaster.hanja + '(' + r.a.dayMaster.ko + ') 와 ' +
      r.b.dayMaster.hanja + '(' + r.b.dayMaster.ko + ') 의 만남';

    $('#compatMeta').innerHTML =
      'A ' + r.a.input.year + '.' + pad(r.a.input.month) + '.' + pad(r.a.input.day) +
      (r.a.input.unknownTime ? ' 시각 미상' : ' ' + pad(r.a.input.hour) + ':' + pad(r.a.input.minute)) +
      ' · ' + r.a.input.cityName +
      ' &nbsp;|&nbsp; B ' + r.b.input.year + '.' + pad(r.b.input.month) + '.' + pad(r.b.input.day) +
      (r.b.input.unknownTime ? ' 시각 미상' : ' ' + pad(r.b.input.hour) + ':' + pad(r.b.input.minute)) +
      ' · ' + r.b.input.cityName;

    // 총점
    $('#compatScore').textContent = String(r.total);
    $('#compatGrade').textContent = r.grade.label + ' · 상위 ' + r.grade.topPercent + '%';
    requestAnimationFrame(function () { $('#compatFill').style.width = r.total + '%'; });

    // 항목별 근거
    var box = $('#compatBreakdown');
    box.innerHTML = '';
    r.parts.forEach(function (p, i) {
      var card = document.createElement('div');
      card.className = 'bd';
      card.innerHTML =
        '<div class="bd__head">' +
          '<span class="bd__title">' + p.title + '</span>' +
          '<span class="bd__score">' + (Math.round(p.score * 10) / 10) + ' / ' + p.max + '</span>' +
        '</div>' +
        '<div class="bd__track"><span class="bd__fill" style="--d:' + (i * .1) + 's"></span></div>' +
        '<div class="bd__rules">' +
          p.rules.map(function (rule) {
            var cls = rule.delta > 0 ? 'is-plus' : (rule.delta < 0 ? 'is-minus' : 'is-zero');
            var sign = rule.delta > 0 ? '+' : '';
            return '<div class="bd__rule">' +
              '<span class="bd__tag">' + rule.tag + '</span>' +
              '<span>' + rule.text + '</span>' +
              '<span class="bd__delta ' + cls + '">' + sign + rule.delta + '</span>' +
            '</div>';
          }).join('') +
        '</div>';
      box.appendChild(card);
      var fill = card.querySelector('.bd__fill');
      requestAnimationFrame(function () { fill.style.width = (p.score / p.max * 100) + '%'; });
    });

    // 서술
    $('#compatNarration').innerHTML = r.narration.map(function (n) {
      return '<div class="card">' +
        '<span class="micro">' + n.title + '</span>' +
        '<p class="card__note" style="margin-top:.9rem">' + n.body + '</p>' +
      '</div>';
    }).join('');

    // 배경은 두 사람 중 더 두터운 오행으로
    if (global.LuneSky) {
      var merged = {};
      [r.a, r.b].forEach(function (c) {
        c.elements.forEach(function (e) { merged[e.key] = (merged[e.key] || 0) + e.count; });
      });
      var top = Object.keys(merged).sort(function (x, y) { return merged[y] - merged[x]; })[0];
      global.LuneSky.setTint(top);
    }
  }

  /* ── 공유 링크 ───────────────────────────────────────────────────── */
  function encode(v) {
    var q = [v.year + '-' + pad(v.month) + '-' + pad(v.day)];
    q.push(v.unknownTime ? 'x' : pad(v.hour) + ':' + pad(v.minute));
    q.push(v.gender);
    q.push(v.cityName);
    return q.join(',');
  }
  function decode(s) {
    if (!s) return null;
    var p = s.split(',');
    var d = (p[0] || '').split('-').map(Number);
    if (d.length !== 3 || d.some(isNaN)) return null;
    var unknown = (p[1] === 'x');
    var t = unknown ? [12, 0] : (p[1] || '12:00').split(':').map(Number);
    return {
      year: d[0], month: d[1], day: d[2],
      hour: t[0], minute: t[1] || 0,
      gender: p[2] || 'M',
      cityName: p[3] || undefined,
      unknownTime: unknown,
      useSolarTime: true,
    };
  }

  $('#compatShareBtn').addEventListener('click', function () {
    if (!last) return;
    var url = location.origin + location.pathname +
      '?a=' + encodeURIComponent(encode(last.a)) +
      '&b=' + encodeURIComponent(encode(last.b));

    var btn = $('#compatShareBtn');
    var done = function (ok) {
      btn.textContent = ok ? '복사했습니다' : '복사 실패 — 주소창을 확인하세요';
      setTimeout(function () { btn.textContent = '공유 링크 복사'; }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });

  $('#compatPrintBtn').addEventListener('click', function () { global.print(); });

  /* ── 링크로 들어온 경우 ──────────────────────────────────────────
   * couple.html?a=1990-05-12,14:30,M,서울&b=…
   * ------------------------------------------------------------- */
  (function prefill() {
    var q = new URLSearchParams(location.search);
    var a = decode(q.get('a'));
    var b = decode(q.get('b'));

    if (a && b) {
      formA.fill(a);
      formB.fill(b);
      $('#compatBtn').click();
      return;
    }

    // 링크가 없으면 저장된 내 정보와 최근 상대를 채워둔다
    if (Store.hasProfile()) formA.fill(Store.getProfile());
    var partner = Store.getPartner();
    if (partner) formB.fill(partner);
    syncRecall();
  })();
})(window);
