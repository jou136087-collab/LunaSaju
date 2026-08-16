/* =========================================================================
 * saju.js — 만세력 명식 산출 엔진
 * 의존: calendar.js (window.Astro), data.js (window.SajuData)
 * window.Saju 로 노출.
 * ========================================================================= */
(function (global) {
  'use strict';

  var A = global.Astro;
  var D = global.SajuData;

  function mod(a, n) { return ((a % n) + n) % n; }

  /* ---------------------------------------------------------------------
   * 십성 판정 — 일간 기준으로 상대 천간의 관계를 반환
   * ------------------------------------------------------------------- */
  function tenGod(dayStemIdx, otherStemIdx) {
    var me = D.STEMS[dayStemIdx];
    var other = D.STEMS[otherStemIdx];
    var same = (me.yin === other.yin);

    if (other.element === me.element)                return same ? '비견' : '겁재';
    if (other.element === D.GENERATES[me.element])   return same ? '식신' : '상관';
    if (other.element === D.CONTROLS[me.element])    return same ? '편재' : '정재';
    if (D.CONTROLS[other.element] === me.element)    return same ? '편관' : '정관';
    if (D.GENERATES[other.element] === me.element)   return same ? '편인' : '정인';
    return '';
  }

  /* 지지의 십성 — 지장간 본기(정기) 기준 */
  function branchTenGod(dayStemIdx, branchIdx) {
    var hidden = D.HIDDEN_STEMS[branchIdx];
    return tenGod(dayStemIdx, hidden[hidden.length - 1]);
  }

  /* 십이운성 */
  function lifeStage(dayStemIdx, branchIdx) {
    var start = D.LIFE_START[dayStemIdx];
    var dir = (dayStemIdx % 2 === 0) ? 1 : -1;
    var step = mod((branchIdx - start) * dir, 12);
    return D.LIFE_STAGES[step];
  }

  /* 60갑자 인덱스 */
  function sexagenaryIndex(stemIdx, branchIdx) {
    for (var i = 0; i < 60; i++) {
      if (i % 10 === stemIdx && i % 12 === branchIdx) return i;
    }
    return -1;
  }

  function makePillar(label, stemIdx, branchIdx, dayStemIdx) {
    var stem = D.STEMS[stemIdx];
    var branch = D.BRANCHES[branchIdx];
    return {
      label: label,
      stemIdx: stemIdx,
      branchIdx: branchIdx,
      stem: stem,
      branch: branch,
      stemGod: (dayStemIdx === null) ? '일간' : tenGod(dayStemIdx, stemIdx),
      branchGod: (dayStemIdx === null) ? '' : branchTenGod(dayStemIdx, branchIdx),
      stage: (dayStemIdx === null) ? '' : lifeStage(dayStemIdx, branchIdx),
      hidden: D.HIDDEN_STEMS[branchIdx].map(function (i) { return D.STEMS[i]; }),
      ganji: stem.hanja + branch.hanja,
      ganjiKo: stem.ko + branch.ko
    };
  }

  /* ---------------------------------------------------------------------
   * 메인 — 명식 산출
   * input: { year, month, day, hour, minute, gender:'M'|'F',
   *          lon, useSolarTime, unknownTime }
   * ------------------------------------------------------------------- */
  function computeChart(input) {
    var y = input.year, m = input.month, d = input.day;
    var hh = input.unknownTime ? 12 : input.hour;
    var mm = input.unknownTime ? 0 : input.minute;

    // 1) 현지 민간시각 -> UT
    var utInfo = A.localToJDUT(y, m, d, hh, mm);
    var jdUT = utInfo.jdUT;

    // 2) 진태양시(경도 보정) 또는 표준시
    var lonOffsetHours = input.useSolarTime
      ? input.lon / 15
      : utInfo.standardOffset;
    var jdLocal = jdUT + lonOffsetHours / 24;
    var local = A.fromJD(jdLocal);

    // 보정량(분) — 표준시 대비
    var correctionMinutes = Math.round((lonOffsetHours - utInfo.standardOffset) * 60);

    // 3) 절기 구간 -> 월지 / 년주 경계
    var lambda = A.solarLongitude(jdUT);
    var terms = A.surroundingTerms(jdUT);
    var monthBranchIdx = terms.term.branch;

    // 사주년: 입춘(황경 315°) 기준
    var sajuYear = y;
    if (m <= 2 && lambda < 315) sajuYear = y - 1;

    var yearStemIdx = mod(sajuYear - 4, 10);
    var yearBranchIdx = mod(sajuYear - 4, 12);

    // 4) 월간 — 五虎遁
    var monthOrder = terms.index; // 0 = 寅월
    var monthStemIdx = mod((yearStemIdx % 5) * 2 + 2 + monthOrder, 10);

    // 5) 일주 — 율리우스일 기준, 야자시(23시 이후)는 다음날로
    var dayJDN = A.toJDN(local.y, local.m, local.d);
    var lateZi = (local.hour >= 23);
    if (lateZi) dayJDN += 1;
    var dayIdx60 = mod(dayJDN - 11, 60);
    var dayStemIdx = dayIdx60 % 10;
    var dayBranchIdx = dayIdx60 % 12;

    // 6) 시주
    var hourBranchIdx = Math.floor(mod(local.hour + 1, 24) / 2);
    var hourStemIdx = mod((dayStemIdx % 5) * 2 + hourBranchIdx, 10);

    // 7) 기둥 조립
    var pillars = {
      year:  makePillar('년주', yearStemIdx, yearBranchIdx, dayStemIdx),
      month: makePillar('월주', monthStemIdx, monthBranchIdx, dayStemIdx),
      day:   makePillar('일주', dayStemIdx, dayBranchIdx, null),
      hour:  input.unknownTime ? null : makePillar('시주', hourStemIdx, hourBranchIdx, dayStemIdx)
    };
    pillars.day.branchGod = branchTenGod(dayStemIdx, dayBranchIdx);
    pillars.day.stage = lifeStage(dayStemIdx, dayBranchIdx);

    var list = [pillars.year, pillars.month, pillars.day];
    if (pillars.hour) list.push(pillars.hour);

    // 8) 오행 분포
    var counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    list.forEach(function (p) {
      counts[p.stem.element] += 1;
      counts[p.branch.element] += 1;
    });
    var total = list.length * 2;
    var elements = D.ELEMENT_ORDER.map(function (k) {
      return {
        key: k,
        ko: D.ELEMENTS[k].ko,
        hanja: D.ELEMENTS[k].hanja,
        label: D.ELEMENTS[k].label,
        count: counts[k],
        ratio: counts[k] / total
      };
    });

    // 9) 십성 분포 (그룹 단위)
    var groups = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    list.forEach(function (p) {
      if (p.stemGod && D.TEN_GODS[p.stemGod]) groups[D.TEN_GODS[p.stemGod].group] += 1;
      if (p.branchGod && D.TEN_GODS[p.branchGod]) groups[D.TEN_GODS[p.branchGod].group] += 1;
    });
    // 일간 자신은 십성이 없으므로 분모에서 뺀다 (천간 4 - 일간 1 + 지지 4 = 7)
    var godTotal = total - 1;
    var godGroups = Object.keys(groups).map(function (k) {
      return { key: k, count: groups[k], ratio: groups[k] / godTotal };
    });

    // 10) 일간의 힘 — 간이 지표
    var support = 0, drain = 0;
    var weightOf = function (p, isBranch) {
      if (p === pillars.month && isBranch) return 3;
      if (p === pillars.day && isBranch) return 2;
      return isBranch ? 1.5 : 1;
    };
    list.forEach(function (p) {
      var pairs = [[p.stemGod, false], [p.branchGod, true]];
      pairs.forEach(function (pair) {
        var g = pair[0];
        if (!g || !D.TEN_GODS[g]) return;
        var grp = D.TEN_GODS[g].group;
        var w = weightOf(p, pair[1]);
        if (grp === '비겁' || grp === '인성') support += w; else drain += w;
      });
    });
    // 일간 자신
    support += 1;
    var strength = support / (support + drain);

    // 11) 공망
    var xun = Math.floor(dayIdx60 / 10);
    var voidBranches = [mod(10 - 2 * xun, 12), mod(11 - 2 * xun, 12)]
      .map(function (i) { return D.BRANCHES[i]; });

    // 12) 대운
    var yangYear = (yearStemIdx % 2 === 0);
    var isMale = (input.gender === 'M');
    var forward = (yangYear === isMale);

    var daysToTerm = forward ? (terms.endJD - jdUT) : (jdUT - terms.startJD);
    var startAgeExact = daysToTerm / 3;
    var startAge = Math.max(1, Math.round(startAgeExact));

    var luckPillars = [];
    for (var i = 1; i <= 10; i++) {
      var dir = forward ? i : -i;
      var s = mod(monthStemIdx + dir, 10);
      var b = mod(monthBranchIdx + dir, 12);
      var lp = makePillar('대운', s, b, dayStemIdx);
      lp.age = startAge + (i - 1) * 10;
      lp.startYear = y + lp.age - 1; // 한국식 나이 기준 근사
      luckPillars.push(lp);
    }

    // 13) 세운 — 올해
    var now = new Date();
    var nowUT = A.localToJDUT(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12, 0).jdUT;
    var nowLambda = A.solarLongitude(nowUT);
    var thisSajuYear = now.getFullYear();
    if (now.getMonth() + 1 <= 2 && nowLambda < 315) thisSajuYear -= 1;
    var ySt = mod(thisSajuYear - 4, 10), yBr = mod(thisSajuYear - 4, 12);
    var yearLuck = makePillar('세운', ySt, yBr, dayStemIdx);
    yearLuck.year = thisSajuYear;

    // 현재 대운 찾기
    var age = now.getFullYear() - y + 1;
    var currentLuck = null;
    for (var j = luckPillars.length - 1; j >= 0; j--) {
      if (age >= luckPillars[j].age) { currentLuck = luckPillars[j]; break; }
    }

    // 14) 절입 정보 (표시용)
    var startTerm = A.fromJD(terms.startJD + utInfo.standardOffset / 24);
    var endTerm = A.fromJD(terms.endJD + utInfo.standardOffset / 24);

    return {
      input: input,
      pillars: pillars,
      list: list,
      dayMaster: D.STEMS[dayStemIdx],
      dayMasterIdx: dayStemIdx,
      elements: elements,
      godGroups: godGroups,
      strength: strength,
      voidBranches: voidBranches,
      luckPillars: luckPillars,
      currentLuck: currentLuck,
      yearLuck: yearLuck,
      forward: forward,
      startAge: startAge,
      age: age,
      meta: {
        solarLongitude: lambda,
        termName: terms.term.name,
        termHanja: terms.term.hanja,
        nextTermName: terms.nextTerm.name,
        termStart: startTerm,
        termEnd: endTerm,
        localTime: local,
        correctionMinutes: correctionMinutes,
        standardOffset: utInfo.standardOffset,
        dst: utInfo.dst,
        lateZi: lateZi,
        sajuYear: sajuYear
      }
    };
  }

  global.Saju = {
    computeChart: computeChart,
    tenGod: tenGod,
    branchTenGod: branchTenGod,
    lifeStage: lifeStage,
    sexagenaryIndex: sexagenaryIndex
  };
})(window);
