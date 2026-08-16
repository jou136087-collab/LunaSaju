/* =========================================================================
 * compat.js — 커플 궁합 판정 엔진
 *
 * 명식 산출은 하지 않는다. saju.js 의 computeChart 결과 두 개를 받아 비교만 한다.
 *
 * 점수 배분은 이 파일이 유일한 근거다 (합계 100)
 *   일지(배우자궁) 30 · 일간 25 · 오행 보완 25 · 나머지 기둥 20
 * 궁합 점수는 유파마다 기준이 다르므로, 어떤 규칙이 몇 점 걸렸는지
 * 전부 rules 배열로 돌려주어 화면에 그대로 공개한다.
 *
 * window.LuneCompat 으로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var D = global.SajuData;
  var S = global.Saju;

  var B = function (i) { return D.BRANCHES[i]; };
  var T = function (i) { return D.STEMS[i]; };

  /* ── 판정 테이블 ─────────────────────────────────────────────────── */

  // 천간합 — 甲己合土 乙庚合金 丙辛合水 丁壬合木 戊癸合火
  var STEM_UNION = [[0, 5, 'earth'], [1, 6, 'metal'], [2, 7, 'water'], [3, 8, 'wood'], [4, 9, 'fire']];
  // 천간충 — 甲庚 乙辛 丙壬 丁癸
  var STEM_CLASH = [[0, 6], [1, 7], [2, 8], [3, 9]];

  // 지지 육합 — 子丑 寅亥 卯戌 辰酉 巳申 午未
  var BRANCH_UNION = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  // 지지 삼합 — 申子辰(水) 亥卯未(木) 寅午戌(火) 巳酉丑(金)
  var BRANCH_TRIO = [
    { set: [8, 0, 4], element: 'water', king: 0 },
    { set: [11, 3, 7], element: 'wood', king: 3 },
    { set: [2, 6, 10], element: 'fire', king: 6 },
    { set: [5, 9, 1], element: 'metal', king: 9 },
  ];
  // 지지 충 — 子午 丑未 寅申 卯酉 辰戌 巳亥
  var BRANCH_CLASH = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  // 지지 형 — 寅巳申·丑戌未 삼형, 子卯 상형, 辰午酉亥 자형
  var BRANCH_PUNISH_PAIRS = [[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]];
  var BRANCH_SELF_PUNISH = [4, 6, 9, 11];
  // 지지 해 — 子未 丑午 寅巳 卯辰 申亥 酉戌
  var BRANCH_HARM = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];

  function pairIn(table, a, b) {
    return table.some(function (p) {
      return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
    });
  }
  function stemUnionOf(a, b) {
    return STEM_UNION.filter(function (p) {
      return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
    })[0] || null;
  }
  function trioOf(a, b) {
    if (a === b) return null;
    return BRANCH_TRIO.filter(function (t) {
      return t.set.indexOf(a) >= 0 && t.set.indexOf(b) >= 0;
    })[0] || null;
  }

  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var round1 = function (v) { return Math.round(v * 10) / 10; };

  /* =====================================================================
   * 1) 일지 — 배우자궁. 가장 무겁게 본다 (30점)
   * =================================================================== */
  function scoreDayBranch(a, b) {
    var x = a.pillars.day.branchIdx, y = b.pillars.day.branchIdx;
    var rules = [];
    var score = 15;

    if (pairIn(BRANCH_UNION, x, y)) {
      score += 12;
      rules.push({ tag: '육합', delta: +12, text: B(x).hanja + B(y).hanja + ' 육합 — 배우자 자리가 서로 끌어당깁니다. 함께 있을 때 편안한 조합입니다.' });
    }
    var trio = trioOf(x, y);
    if (trio) {
      var half = (x === trio.king || y === trio.king);
      var d = half ? 10 : 6;
      score += d;
      rules.push({
        tag: half ? '반합' : '삼합',
        delta: +d,
        text: B(x).hanja + B(y).hanja + ' ' + D.ELEMENTS[trio.element].hanja + '국 ' + (half ? '반합' : '삼합') +
              ' — 같은 방향을 보는 사이입니다. 함께 무언가를 만들 때 힘이 붙습니다.',
      });
    }
    if (x === y) {
      score += 4;
      rules.push({ tag: '비화', delta: +4, text: '일지가 ' + B(x).hanja + '으로 같습니다 — 생활 리듬과 취향이 닮았습니다. 다만 약점도 같이 갖습니다.' });
    }
    if (pairIn(BRANCH_CLASH, x, y)) {
      score -= 12;
      rules.push({ tag: '충', delta: -12, text: B(x).hanja + B(y).hanja + ' 충 — 배우자 자리가 정면으로 부딪힙니다. 거리와 속도를 서로 합의해 두어야 합니다.' });
    }
    if (pairIn(BRANCH_PUNISH_PAIRS, x, y) || (x === y && BRANCH_SELF_PUNISH.indexOf(x) >= 0)) {
      score -= 8;
      rules.push({ tag: '형', delta: -8, text: B(x).hanja + B(y).hanja + ' 형 — 가까울수록 서로를 긁는 자리입니다. 말의 온도를 낮추는 것이 관건입니다.' });
    }
    if (pairIn(BRANCH_HARM, x, y)) {
      score -= 5;
      rules.push({ tag: '해', delta: -5, text: B(x).hanja + B(y).hanja + ' 해 — 사소한 오해가 쌓이기 쉽습니다. 넘겨짚지 말고 물어보는 편이 낫습니다.' });
    }
    if (!rules.length) {
      rules.push({ tag: '무관', delta: 0, text: B(x).hanja + '과 ' + B(y).hanja + ' 사이에 특별한 합도 충도 없습니다. 서로의 영역을 침범하지 않는 담백한 관계입니다.' });
    }

    return { key: 'dayBranch', title: '일지 — 배우자 자리', max: 30, score: clamp(score, 0, 30), rules: rules };
  }

  /* =====================================================================
   * 2) 일간 — 두 사람 자신 (25점)
   * =================================================================== */
  function scoreDayStem(a, b) {
    var x = a.dayMasterIdx, y = b.dayMasterIdx;
    var ex = T(x).element, ey = T(y).element;
    var rules = [];
    var score = 12;

    var union = stemUnionOf(x, y);
    if (union) {
      score += 10;
      rules.push({
        tag: '천간합',
        delta: +10,
        text: T(x).hanja + T(y).hanja + ' 합 → ' + D.ELEMENTS[union[2]].hanja +
              ' — 두 사람 자신이 서로에게 끌리는 배치입니다. 명리에서 가장 뚜렷한 인력입니다.',
      });
    }
    if (pairIn(STEM_CLASH, x, y)) {
      score -= 8;
      rules.push({ tag: '천간충', delta: -8, text: T(x).hanja + T(y).hanja + ' 충 — 성향이 정반대라 부딪히면 크게 부딪힙니다. 역할을 나눠두면 오히려 강점이 됩니다.' });
    }
    if (x === y) {
      score += 4;
      rules.push({ tag: '동일', delta: +4, text: '일간이 ' + T(x).hanja + '으로 같습니다 — 서로를 설명 없이 이해합니다. 대신 같은 실수를 반복할 수 있습니다.' });
    }

    if (!union && ex !== ey) {
      if (D.GENERATES[ex] === ey) {
        score += 6;
        rules.push({ tag: '상생', delta: +6, text: D.ELEMENTS[ex].hanja + '生' + D.ELEMENTS[ey].hanja + ' — A가 B를 북돋는 흐름입니다. A가 주고 B가 자라는 관계입니다.' });
      } else if (D.GENERATES[ey] === ex) {
        score += 6;
        rules.push({ tag: '상생', delta: +6, text: D.ELEMENTS[ey].hanja + '生' + D.ELEMENTS[ex].hanja + ' — B가 A를 북돋는 흐름입니다. B가 주고 A가 자라는 관계입니다.' });
      } else if (D.CONTROLS[ex] === ey || D.CONTROLS[ey] === ex) {
        score -= 4;
        rules.push({ tag: '상극', delta: -4, text: '오행이 서로 극하는 배치입니다. 한쪽이 눌리는 느낌을 받기 쉬우니 결정권을 영역별로 나누세요.' });
      }
    }

    // 십성 역학 — 서로가 서로에게 무엇인지
    var aToB = S.tenGod(x, y);   // A 일간이 볼 때 B 는
    var bToA = S.tenGod(y, x);
    var proper = ['정관', '정인', '정재', '식신'];
    var rough = ['편관', '상관', '겁재'];
    var properCount = [aToB, bToA].filter(function (g) { return proper.indexOf(g) >= 0; }).length;
    var roughCount = [aToB, bToA].filter(function (g) { return rough.indexOf(g) >= 0; }).length;

    if (properCount === 2) {
      score += 3;
      rules.push({ tag: '십성', delta: +3, text: 'A에게 B는 ' + aToB + ', B에게 A는 ' + bToA + ' — 양쪽 다 안정적인 역할입니다. 오래 가는 배치입니다.' });
    } else if (roughCount === 2) {
      score -= 3;
      rules.push({ tag: '십성', delta: -3, text: 'A에게 B는 ' + aToB + ', B에게 A는 ' + bToA + ' — 서로를 자극하는 역할입니다. 강렬한 대신 소모도 큽니다.' });
    } else {
      rules.push({ tag: '십성', delta: 0, text: 'A에게 B는 ' + aToB + ', B에게 A는 ' + bToA + ' — 한쪽은 안정, 한쪽은 자극입니다. 역할이 비대칭이라는 뜻입니다.' });
    }

    return {
      key: 'dayStem', title: '일간 — 두 사람 자신', max: 25,
      score: clamp(score, 0, 25), rules: rules, aToB: aToB, bToA: bToA,
    };
  }

  /* =====================================================================
   * 3) 오행 보완 (25점)
   *    한쪽의 부족을 다른 쪽이 채우는가 + 일간의 힘이 상보적인가
   * =================================================================== */
  function scoreElements(a, b) {
    var rules = [];

    function counts(c) {
      var m = {};
      c.elements.forEach(function (e) { m[e.key] = e.count; });
      return m;
    }
    var ca = counts(a), cb = counts(b);

    /** who 에게 부족한 오행 중 other 가 넉넉히(2 이상) 가진 비율 */
    function fillRate(mine, other) {
      var lacking = D.ELEMENT_ORDER.filter(function (k) { return mine[k] <= 1; });
      if (!lacking.length) return { rate: 1, lacking: [], filled: [] };
      var filled = lacking.filter(function (k) { return other[k] >= 2; });
      return { rate: filled.length / lacking.length, lacking: lacking, filled: filled };
    }

    var fa = fillRate(ca, cb), fb = fillRate(cb, ca);
    var rate = (fa.rate + fb.rate) / 2;
    var fillScore = rate * 18;

    function describe(who, f, otherLabel) {
      var name = function (k) { return D.ELEMENTS[k].hanja + '(' + D.ELEMENTS[k].ko + ')'; };
      if (!f.lacking.length) {
        return who + '는 다섯 기운이 고르게 갖춰져 따로 채울 것이 없습니다.';
      }
      if (!f.filled.length) {
        return who + '에게 얇은 ' + f.lacking.map(name).join('·') + ' 기운을 ' + otherLabel + '도 넉넉히 갖고 있지 않습니다.';
      }
      return who + '에게 얇은 ' + f.lacking.map(name).join('·') + ' 중 ' +
             f.filled.map(name).join('·') + ' 을(를) ' + otherLabel + '가 넉넉히 가지고 있습니다.';
    }

    rules.push({ tag: 'A 보완', delta: round1(fa.rate * 9), text: describe('A', fa, 'B') });
    rules.push({ tag: 'B 보완', delta: round1(fb.rate * 9), text: describe('B', fb, 'A') });

    // 일간의 힘 — 한쪽이 강하고 한쪽이 약하면 서로를 받쳐준다
    var da = a.strength - 0.5, db = b.strength - 0.5;
    var comp = clamp(1 - Math.abs(da + db) / 0.5, 0, 1);
    var strengthScore = comp * 7;
    var label = function (c) { return c.strength >= 0.62 ? '신강' : (c.strength >= 0.45 ? '중화' : '신약'); };
    rules.push({
      tag: '일간의 힘',
      delta: round1(strengthScore),
      text: 'A는 ' + label(a) + '(' + Math.round(a.strength * 100) + '%), B는 ' + label(b) + '(' + Math.round(b.strength * 100) + '%) — ' +
            (comp >= 0.7
              ? '한쪽이 밀고 한쪽이 받쳐주는 상보적인 배치입니다.'
              : (da > 0 && db > 0
                ? '둘 다 스스로 밀고 나가는 쪽이라 주도권이 겹칩니다. 영역을 나누는 편이 낫습니다.'
                : '둘 다 기대는 쪽이라 결정이 미뤄지기 쉽습니다. 역할을 미리 정해 두세요.')),
    });

    return {
      key: 'elements', title: '오행 보완 — 서로의 빈칸', max: 25,
      score: clamp(fillScore + strengthScore, 0, 25), rules: rules,
    };
  }

  /* =====================================================================
   * 4) 나머지 기둥 — 년·월·시 (20점)
   * =================================================================== */
  function scoreOtherPillars(a, b) {
    var rules = [];
    var score = 10;

    var slots = [
      { key: 'year', label: '년지', hint: '뿌리·집안 배경' },
      { key: 'month', label: '월지', hint: '사회 활동·생활 무대' },
      { key: 'hour', label: '시지', hint: '말년·자녀 자리' },
    ];

    slots.forEach(function (slot) {
      var pa = a.pillars[slot.key], pb = b.pillars[slot.key];
      if (!pa || !pb) {
        rules.push({ tag: slot.label, delta: 0, text: '한쪽이라도 태어난 시각을 모르면 ' + slot.label + '는 비교에서 뺍니다.' });
        return;
      }
      var x = pa.branchIdx, y = pb.branchIdx;
      var d = 0, note = [];

      if (pairIn(BRANCH_UNION, x, y)) { d += 3; note.push('육합'); }
      if (trioOf(x, y)) { d += 2.5; note.push('삼합'); }
      if (pairIn(BRANCH_CLASH, x, y)) { d -= 3; note.push('충'); }
      if (pairIn(BRANCH_PUNISH_PAIRS, x, y)) { d -= 2; note.push('형'); }
      if (pairIn(BRANCH_HARM, x, y)) { d -= 1.5; note.push('해'); }

      score += d;
      rules.push({
        tag: slot.label,
        delta: round1(d),
        text: B(x).hanja + ' · ' + B(y).hanja +
              (note.length ? ' — ' + note.join('·') + '. ' : ' — 특별한 관계 없음. ') +
              slot.hint + '에서 ' +
              (d > 0 ? '서로 도움이 됩니다.' : d < 0 ? '마찰이 생길 수 있습니다.' : '간섭이 적습니다.'),
      });
    });

    return {
      key: 'others', title: '나머지 기둥 — 년 · 월 · 시', max: 20,
      score: clamp(score, 0, 20), rules: rules,
    };
  }

  /* =====================================================================
   * 등급 · 서술
   * =================================================================== */
  /* 무작위 6,000쌍의 실제 점수 분포에서 뽑은 백분위 기준점.
   * [점수, 하위 몇 %] — 중립 조합이 50점 부근이고 65점이면 상위 10% 다.
   * 이 표가 없으면 "85점 이상 = 천생연분" 같은 임의 경계를 쓰게 되는데,
   * 그런 점수는 실제로는 거의 나오지 않아 등급이 무의미해진다.
   * tools/test-compat.mjs 가 분포를 다시 재므로, 배점을 고치면 이 표도 갱신할 것. */
  var PERCENTILES = [
    [22, 1], [31, 5], [35, 10], [39, 15], [42, 25], [46, 35],
    [50, 50], [55, 65], [57, 70], [60, 80], [62, 85], [65, 90], [69, 95], [73, 99],
  ];

  /** 점수 → 상위 몇 % 인지 (1~99) */
  function topPercent(total) {
    var lo = PERCENTILES[0], hi = PERCENTILES[PERCENTILES.length - 1];
    if (total <= lo[0]) return 99;
    if (total >= hi[0]) return 1;
    for (var i = 1; i < PERCENTILES.length; i++) {
      var p = PERCENTILES[i - 1], q = PERCENTILES[i];
      if (total <= q[0]) {
        var t = (total - p[0]) / (q[0] - p[0]);
        return Math.max(1, Math.min(99, Math.round(100 - (p[1] + t * (q[1] - p[1])))));
      }
    }
    return 50;
  }

  function gradeOf(total) {
    var top = topPercent(total);
    var g;
    if (total >= 65) g = { label: '아주 잘 맞물리는 조합', tone: 'high' };
    else if (total >= 57) g = { label: '잘 맞는 편', tone: 'good' };
    else if (total >= 46) g = { label: '무난한 조합', tone: 'mid' };
    else if (total >= 39) g = { label: '조율이 필요한 조합', tone: 'low' };
    else g = { label: '상당한 조율이 필요한 조합', tone: 'hard' };
    g.topPercent = top;
    return g;
  }

  function narrate(parts, a, b, total) {
    var all = parts.reduce(function (acc, p) {
      return acc.concat(p.rules.map(function (r) { return { part: p.title, rule: r }; }));
    }, []);
    var plus = all.filter(function (x) { return x.rule.delta > 0; })
      .sort(function (m, n) { return n.rule.delta - m.rule.delta; });
    var minus = all.filter(function (x) { return x.rule.delta < 0; })
      .sort(function (m, n) { return m.rule.delta - n.rule.delta; });

    var stem = parts.filter(function (p) { return p.key === 'dayStem'; })[0];

    var fit = plus.length
      ? plus.slice(0, 3).map(function (x) { return x.rule.text; }).join(' ')
      : '두드러지게 끌어당기는 배치는 없습니다. 대신 서로를 흔드는 요소도 적어, 관계의 모양을 두 사람이 직접 정해 갈 수 있는 백지에 가깝습니다.';

    var friction = minus.length
      ? minus.slice(0, 3).map(function (x) { return x.rule.text; }).join(' ')
      : '명식 안에서 정면으로 부딪히는 자리는 보이지 않습니다. 갈등이 생긴다면 타고난 배치보다 그때의 상황과 습관 쪽을 살펴보세요.';

    var tip = '두 사람은 ' + a.dayMaster.hanja + '(' + a.dayMaster.ko + ')와 ' +
      b.dayMaster.hanja + '(' + b.dayMaster.ko + ') 일간입니다. ' +
      'A에게 B는 ' + stem.aToB + ', B에게 A는 ' + stem.bToA + '으로 작용하니, ' +
      (stem.aToB === stem.bToA
        ? '서로에게 같은 역할을 합니다. 주고받는 것이 대칭이라 공평한 대신, 둘 다 같은 지점에서 지칩니다.'
        : '주고받는 것이 서로 다릅니다. 한쪽이 기대하는 방식과 다른 쪽이 주는 방식이 어긋날 수 있으니, 무엇을 원하는지 말로 확인하는 편이 빠릅니다.') +
      (total < 55
        ? ' 점수가 낮게 나왔다고 해서 맞지 않는 사이라는 뜻이 아닙니다. 부딪히는 자리를 미리 알고 규칙을 정해 두면, 오히려 서로를 가장 크게 키우는 조합이 되기도 합니다.'
        : ' 잘 맞는 배치일수록 익숙함에 기대기 쉽습니다. 관계에 들이는 품을 줄이지 않는 것이 이 조합의 유일한 숙제입니다.');

    return [
      { title: '맞물리는 지점', body: fit },
      { title: '부딪히는 지점', body: friction },
      { title: '관계 운영 팁', body: tip },
    ];
  }

  /* =====================================================================
   * 진입점
   * =================================================================== */
  function compare(a, b) {
    var parts = [
      scoreDayBranch(a, b),
      scoreDayStem(a, b),
      scoreElements(a, b),
      scoreOtherPillars(a, b),
    ];
    var total = clamp(Math.round(parts.reduce(function (s, p) { return s + p.score; }, 0)), 0, 100);

    return {
      a: a, b: b,
      parts: parts,
      total: total,
      grade: gradeOf(total),
      narration: narrate(parts, a, b, total),
    };
  }

  global.LuneCompat = {
    compare: compare,
    gradeOf: gradeOf,
    topPercent: topPercent,
    // 테스트용 노출
    _tables: {
      STEM_UNION: STEM_UNION, STEM_CLASH: STEM_CLASH,
      BRANCH_UNION: BRANCH_UNION, BRANCH_TRIO: BRANCH_TRIO,
      BRANCH_CLASH: BRANCH_CLASH, BRANCH_PUNISH_PAIRS: BRANCH_PUNISH_PAIRS,
      BRANCH_HARM: BRANCH_HARM,
    },
  };
})(window);
