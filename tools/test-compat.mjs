/* 궁합 엔진 검증
 *   node tools/test-compat.mjs
 * 판정 테이블의 무결성(대칭·전수 포함·간격)과 점수 범위를 검사한다. */
import { loadBrowserModules, makeReporter } from './_load.mjs';

const { SajuData: D, Saju: S, LuneCompat: C } = loadBrowserModules(
  ['calendar.js', 'data.js', 'saju.js', 'compat.js'],
);
const Tb = C._tables;
let failures = 0;

const uniqueCover = (pairs, size) => {
  const seen = new Set();
  for (const p of pairs) for (const i of p) seen.add(i);
  return seen.size === size && pairs.length * pairs[0].length === size;
};
const offsets = (pairs, n) => pairs.map(([a, b]) => Math.min((a - b + n) % n, (b - a + n) % n));

/* ─────────────────────────────────────────────────────────────────────
 * 1) 천간 테이블
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('1) 천간 합 · 충');
  const u = Tb.STEM_UNION.map(([a, b]) => [a, b]);
  r.ok(u.length === 5, '천간합 5조', `${u.length}조`);
  r.ok(uniqueCover(u, 10), '천간 10개를 중복 없이 전부 사용');
  r.ok(offsets(u, 10).every((o) => o === 5), '합은 모두 간격 5', offsets(u, 10).join(','));

  r.ok(Tb.STEM_CLASH.length === 4, '천간충 4조 (戊己는 충이 없다)', `${Tb.STEM_CLASH.length}조`);
  r.ok(offsets(Tb.STEM_CLASH, 10).every((o) => o === 4 || o === 6),
    '충은 간격 6 (mod 10 에서 4로 접힘)', offsets(Tb.STEM_CLASH, 10).join(','));

  // 합이 만드는 오행이 서로 다른 5행이어야 한다
  const made = new Set(Tb.STEM_UNION.map((p) => p[2]));
  r.ok(made.size === 5, '천간합이 만드는 오행이 5행 전부', [...made].join(','));
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 2) 지지 테이블
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('2) 지지 합 · 충 · 형 · 해');

  r.ok(Tb.BRANCH_UNION.length === 6, '육합 6조', `${Tb.BRANCH_UNION.length}조`);
  r.ok(uniqueCover(Tb.BRANCH_UNION, 12), '육합이 지지 12개를 중복 없이 전부 사용');
  // 육합은 子丑(합 1) 외에는 두 인덱스의 합이 13
  const unionSums = Tb.BRANCH_UNION.map(([a, b]) => a + b);
  r.ok(unionSums.filter((s) => s === 13).length === 5 && unionSums.includes(1),
    '육합은 子丑 외 인덱스 합이 13', unionSums.join(','));

  r.ok(Tb.BRANCH_CLASH.length === 6, '충 6조', `${Tb.BRANCH_CLASH.length}조`);
  r.ok(uniqueCover(Tb.BRANCH_CLASH, 12), '충이 지지 12개를 중복 없이 전부 사용');
  r.ok(offsets(Tb.BRANCH_CLASH, 12).every((o) => o === 6), '충은 모두 정반대(간격 6)');

  r.ok(Tb.BRANCH_TRIO.length === 4, '삼합 4국', `${Tb.BRANCH_TRIO.length}국`);
  const trioSeen = new Set(Tb.BRANCH_TRIO.flatMap((t) => t.set));
  r.ok(trioSeen.size === 12, '삼합이 지지 12개를 전부 사용', `${trioSeen.size}개`);
  const spacingOk = Tb.BRANCH_TRIO.every((t) => {
    const [a, b, c] = t.set;
    return (b - a + 12) % 12 === 4 && (c - b + 12) % 12 === 4;
  });
  r.ok(spacingOk, '삼합 세 글자가 4칸 간격');
  const kingOk = Tb.BRANCH_TRIO.every((t) => t.set.indexOf(t.king) === 1);
  r.ok(kingOk, '삼합의 왕지가 가운데 글자');

  r.ok(Tb.BRANCH_HARM.length === 6, '해 6조', `${Tb.BRANCH_HARM.length}조`);
  r.ok(uniqueCover(Tb.BRANCH_HARM, 12), '해가 지지 12개를 중복 없이 전부 사용');

  // 같은 두 글자가 합이면서 동시에 충일 수는 없다
  let conflict = 0;
  for (const [a, b] of Tb.BRANCH_UNION) {
    if (Tb.BRANCH_CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) conflict++;
  }
  r.ok(conflict === 0, '육합과 충이 겹치는 조합 없음', `${conflict}건`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 3) 점수 대칭성 · 범위
 * ─────────────────────────────────────────────────────────────────── */
const chart = (o) => S.computeChart({
  hour: 12, minute: 0, gender: 'M', lon: 126.978,
  useSolarTime: true, unknownTime: false, ...o,
});
{
  const r = makeReporter('3) 점수 대칭성 · 범위 (무작위 500쌍)');
  let asym = 0, outOfRange = 0, partBad = 0, noRules = 0;
  const totals = [];

  for (let k = 0; k < 500; k++) {
    const a = chart({
      year: 1950 + (k * 7) % 76, month: 1 + (k * 5) % 12, day: 1 + (k * 11) % 28,
      hour: (k * 13) % 24, minute: (k * 7) % 60, gender: k % 2 ? 'M' : 'F',
    });
    const b = chart({
      year: 1950 + (k * 13) % 76, month: 1 + (k * 3) % 12, day: 1 + (k * 17) % 28,
      hour: (k * 19) % 24, minute: (k * 23) % 60, gender: k % 2 ? 'F' : 'M',
    });

    const ab = C.compare(a, b);
    const ba = C.compare(b, a);

    // A-B 가 합이면 B-A 도 합이다. 총점은 순서에 의존하면 안 된다.
    if (ab.total !== ba.total) asym++;
    if (ab.total < 0 || ab.total > 100) outOfRange++;
    for (const p of ab.parts) {
      if (p.score < 0 || p.score > p.max) partBad++;
      if (!p.rules.length) noRules++;
    }
    totals.push(ab.total);
  }

  r.ok(asym === 0, '총점이 A·B 순서에 무관 (대칭)', `이상 ${asym}건`);
  r.ok(outOfRange === 0, '총점 0~100 범위', `이상 ${outOfRange}건`);
  r.ok(partBad === 0, '항목별 점수가 각자의 배점 안', `이상 ${partBad}건`);
  r.ok(noRules === 0, '모든 항목이 근거를 최소 1개 제시', `이상 ${noRules}건`);

  totals.sort((x, y) => x - y);
  r.info(`총점 분포 — 최저 ${totals[0]} / 중앙 ${totals[Math.floor(totals.length / 2)]} / 최고 ${totals[totals.length - 1]}`);
  const spread = totals[totals.length - 1] - totals[0];
  r.ok(spread >= 30, '점수가 한 점에 몰리지 않고 벌어짐', `폭 ${spread}점`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 4) 알려진 조합 스팟체크
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('4) 규칙 적중 스팟체크');

  // 일지가 충(子午)인 두 명식을 만들어 '충' 규칙이 실제로 걸리는지 본다
  const findByDayBranch = (want) => {
    for (let k = 0; k < 4000; k++) {
      const c = chart({
        year: 1980 + (k % 40), month: 1 + (k * 5) % 12, day: 1 + (k * 11) % 28, hour: 10,
      });
      if (c.pillars.day.branchIdx === want) return c;
    }
    return null;
  };

  const zi = findByDayBranch(0);   // 子
  const wu = findByDayBranch(6);   // 午
  const chou = findByDayBranch(1); // 丑

  r.ok(zi && wu && chou, '테스트용 명식 확보 (子 · 午 · 丑 일지)');

  if (zi && wu) {
    const res = C.compare(zi, wu);
    const day = res.parts.find((p) => p.key === 'dayBranch');
    r.ok(day.rules.some((x) => x.tag === '충'), '子午 일지 → 충 규칙 적중',
      day.rules.map((x) => x.tag).join(','));
  }
  if (zi && chou) {
    const res = C.compare(zi, chou);
    const day = res.parts.find((p) => p.key === 'dayBranch');
    r.ok(day.rules.some((x) => x.tag === '육합'), '子丑 일지 → 육합 규칙 적중',
      day.rules.map((x) => x.tag).join(','));
  }

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 5) 등급 보정 — 경계가 실제 분포 위에 놓여 있는가
 *    임의로 정한 경계는 "85점 이상 = 천생연분" 처럼 도달 불가능해지기 쉽다.
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('5) 등급 · 백분위 보정');

  const totals = [];
  for (let k = 0; k < 3000; k++) {
    const a = chart({
      year: 1950 + (k * 7) % 76, month: 1 + (k * 5) % 12, day: 1 + (k * 11) % 28,
      hour: (k * 13) % 24, minute: (k * 7) % 60, gender: k % 2 ? 'M' : 'F',
    });
    const b = chart({
      year: 1950 + (k * 13) % 76, month: 1 + (k * 3) % 12, day: 1 + (k * 17) % 28,
      hour: (k * 19) % 24, minute: (k * 23) % 60, gender: k % 2 ? 'F' : 'M',
    });
    totals.push(C.compare(a, b).total);
  }
  totals.sort((x, y) => x - y);
  const share = (fn) => totals.filter(fn).length / totals.length;

  // 5단계가 전부 실제로 나와야 하고, 어느 한 등급이 전체를 삼켜서도 안 된다
  const buckets = {};
  for (const t of totals) buckets[C.gradeOf(t).tone] = (buckets[C.gradeOf(t).tone] || 0) + 1;
  const tones = ['high', 'good', 'mid', 'low', 'hard'];
  const missing = tones.filter((t) => !buckets[t]);
  r.ok(missing.length === 0, '등급 5단계가 실제 분포에서 모두 등장', missing.join(',') || '전부 등장');

  const biggest = Math.max(...tones.map((t) => (buckets[t] || 0) / totals.length));
  r.ok(biggest < 0.55, '한 등급이 전체의 55% 를 넘지 않음', `최대 ${(biggest * 100).toFixed(1)}%`);

  const topShare = share((t) => t >= 65);
  r.ok(topShare > 0.02 && topShare < 0.25,
    '최상위 등급이 희소하되 도달 가능 (2~25%)', `${(topShare * 100).toFixed(1)}%`);

  // 백분위 함수가 단조 감소해야 한다 (점수가 높을수록 상위 %)
  let monoBad = 0;
  for (let s = 1; s <= 100; s++) if (C.topPercent(s) > C.topPercent(s - 1)) monoBad++;
  r.ok(monoBad === 0, '백분위가 점수에 대해 단조', `이상 ${monoBad}건`);

  r.info(`등급 분포 — ${tones.map((t) => t + ' ' + (((buckets[t] || 0) / totals.length) * 100).toFixed(0) + '%').join(' / ')}`);
  failures += r.done();
}

console.log(failures === 0 ? '\n✅ test-compat 전체 통과\n' : `\n❌ test-compat 실패 ${failures}건\n`);
process.exit(failures === 0 ? 0 : 1);
