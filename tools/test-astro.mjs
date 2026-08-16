/* 천문 계산 회귀 테스트
 *   node tools/test-astro.mjs
 * 태양황경(VSOP87 절단급수) · 절기 시각 · 월지 경계 매핑을 검증한다.
 * 이 값이 바뀌면 calendar.js 를 잘못 건드린 것이다. */
import { loadBrowserModules, fmtKST, parseKST, makeReporter, pad } from './_load.mjs';

const { Astro: A } = loadBrowserModules(['calendar.js']);
const RAD = Math.PI / 180;
const mod360 = (a) => ((a % 360) + 360) % 360;

let failures = 0;

/* ─────────────────────────────────────────────────────────────────────
 * 1) 계수 오타 탐지
 *    VSOP87 절단급수를 Meeus ch.25 저정밀식과 대조한다. 저정밀식의 공차가
 *    0.01° 이므로, 두 값이 그 안에서 만나면 큰 계수에 오타가 없다는 뜻이다.
 * ─────────────────────────────────────────────────────────────────── */
function lowPrecisionTT(jdTT) {
  const T = (jdTT - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr);
  const om = 125.04 - 1934.136 * T;
  return mod360(L0 + C - 0.00569 - 0.00478 * Math.sin(om * RAD));
}
{
  const r = makeReporter('1) VSOP87 절단급수 무결성');
  let maxDiff = 0, at = 0;
  for (let jd = A.toJD(1900, 1, 1); jd < A.toJD(2100, 1, 1); jd += 3.7) {
    const dt = A.deltaT(2000 + (jd - 2451545) / 365.25) / 86400;
    const diff = Math.abs(mod360(A.solarLongitude(jd) - lowPrecisionTT(jd + dt) + 180) - 180);
    if (diff > maxDiff) { maxDiff = diff; at = jd; }
  }
  const w = A.fromJD(at);
  r.ok(maxDiff < 0.02, '저정밀식과의 최대 편차가 공차 이내',
    `${maxDiff.toFixed(5)}° @ ${w.y}-${pad(w.m)}-${pad(w.d)}`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 2) 한국천문연구원 공표 절기 시각 대조 (KST)
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('2) 공표 절기 시각 대조');
  const cases = [
    ['2024 춘분', 2024, 3, 20, 0, '2024-03-20 12:06'],
    ['2024 하지', 2024, 6, 21, 90, '2024-06-21 05:51'],
    ['2024 추분', 2024, 9, 22, 180, '2024-09-22 21:44'],
    ['2024 동지', 2024, 12, 21, 270, '2024-12-21 18:21'],
    ['2025 춘분', 2025, 3, 20, 0, '2025-03-20 18:01'],
    ['2025 동지', 2025, 12, 22, 270, '2025-12-22 00:03'],
    ['2000 춘분', 2000, 3, 20, 0, '2000-03-20 16:35'],
    ['2024 입춘', 2024, 2, 4, 315, '2024-02-04 17:27'],
    ['2025 입춘', 2025, 2, 3, 315, '2025-02-03 23:10'],
    ['2026 입춘', 2026, 2, 4, 315, '2026-02-04 05:02'],
  ];
  for (const [label, y, m, d, lon, expected] of cases) {
    const jd = A.findSolarTermJD(A.toJD(y, m, d), lon);
    const diffMin = Math.round((jd - parseKST(A, expected)) * 1440);
    r.ok(Math.abs(diffMin) <= 1, `${label} (λ=${lon}°)`,
      `계산 ${fmtKST(A, jd)} / 공표 ${expected} / 차 ${diffMin >= 0 ? '+' : ''}${diffMin}분`);
  }
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 3) 황경 -> 월지 경계 매핑
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('3) 12절 경계 매핑');
  let bad = 0;
  for (let i = 0; i < 12; i++) {
    const t = A.MAJOR_TERMS[i];
    if (A.termIndexFromLongitude(t.lon + 0.001) !== i) bad++;
    if (A.termIndexFromLongitude(t.lon - 0.001) !== (i + 11) % 12) bad++;
  }
  r.ok(bad === 0, '경계 12곳 전후 구간이 모두 정합', `이상 ${bad}건`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 4) surroundingTerms 구간 포함성
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('4) 절기 구간 산출');
  let notInside = 0, badSpan = 0;
  for (let k = 0; k < 400; k++) {
    const jd = A.toJD(1930 + (k % 90), 1 + (k * 7) % 12, 1 + (k * 13) % 28) + (k % 24) / 24;
    const s = A.surroundingTerms(jd);
    if (!(s.startJD <= jd && jd < s.endJD)) notInside++;
    const span = s.endJD - s.startJD;
    if (span < 29 || span > 32.5) badSpan++;
  }
  r.ok(notInside === 0, '무작위 400개 시각이 모두 자기 구간 안에 있음', `이상 ${notInside}건`);
  r.ok(badSpan === 0, '구간 길이가 29~32.5일 범위', `이상 ${badSpan}건`);
  failures += r.done();
}

console.log(failures === 0 ? '\n✅ test-astro 전체 통과\n' : `\n❌ test-astro 실패 ${failures}건\n`);
process.exit(failures === 0 ? 0 : 1);
