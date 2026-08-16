/* 명식 산출 회귀 테스트
 *   node tools/test-saju.mjs
 * 일주 앵커 · 五虎遁 · 五鼠遁 · 십성 · 십이운성 · 절기 경계 케이스를 검증한다. */
import { loadBrowserModules, makeReporter, pad } from './_load.mjs';

const { Astro: A, SajuData: D, Saju: S } = loadBrowserModules();
let failures = 0;

const dayIndex = (y, m, d) => ((A.toJDN(y, m, d) - 11) % 60 + 60) % 60;
const dayGanji = (y, m, d) => {
  const i = dayIndex(y, m, d);
  return D.STEMS[i % 10].hanja + D.BRANCHES[i % 12].hanja;
};

/* ─────────────────────────────────────────────────────────────────────
 * 1) 일주 60갑자 앵커
 *    2000-01-01 = 戊午. 이 한 점이 어긋나면 모든 일주가 어긋난다.
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('1) 일주 앵커');
  r.ok(dayGanji(2000, 1, 1) === '戊午', '2000-01-01 = 戊午', dayGanji(2000, 1, 1));
  r.ok(dayGanji(2000, 1, 2) === '己未', '다음 날 = 己未 (연속성)', dayGanji(2000, 1, 2));
  r.ok(dayIndex(2000, 1, 1) === 54, '60갑자 인덱스 54', String(dayIndex(2000, 1, 1)));
  // 흔한 오기 방어: 1984 는 갑자'년'이지 1984-02-02 가 갑자'일'인 것이 아니다
  r.ok(dayGanji(1984, 2, 2) === '丙寅', '1984-02-02 = 丙寅 (갑자일 아님)', dayGanji(1984, 2, 2));
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 2) 十干 배치 규칙
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('2) 五虎遁 / 五鼠遁');
  const tigerExpected = ['丙', '戊', '庚', '壬', '甲', '丙', '戊', '庚', '壬', '甲'];
  const ratExpected   = ['甲', '丙', '戊', '庚', '壬', '甲', '丙', '戊', '庚', '壬'];
  let tigerBad = 0, ratBad = 0;
  for (let i = 0; i < 10; i++) {
    if (D.STEMS[((i % 5) * 2 + 2) % 10].hanja !== tigerExpected[i]) tigerBad++;
    if (D.STEMS[((i % 5) * 2) % 10].hanja !== ratExpected[i]) ratBad++;
  }
  r.ok(tigerBad === 0, '五虎遁 — 년간별 寅월 천간 10종', `이상 ${tigerBad}건`);
  r.ok(ratBad === 0, '五鼠遁 — 일간별 子시 천간 10종', `이상 ${ratBad}건`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 3) 십성 · 십이운성
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('3) 십성 / 십이운성');
  // 양간(甲)과 음간(乙)은 서로 다른 배열을 갖는다. 짝수 오프셋(같은 음양)에서만 일치하고
  // 홀수 오프셋에서는 갈린다 — 음양이 함께 밀리기 때문이다.
  const YANG = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const YIN  = ['비견', '상관', '식신', '정재', '편재', '정관', '편관', '정인', '편인', '겁재'];

  let bad = 0;
  for (let i = 0; i < 10; i++) if (S.tenGod(0, i) !== YANG[i]) bad++;
  r.ok(bad === 0, '甲 일간 기준 천간 10종 십성', `이상 ${bad}건`);

  let shiftBad = 0;
  for (let day = 0; day < 10; day++) {
    const row = (day % 2 === 0) ? YANG : YIN;
    for (let k = 0; k < 10; k++) {
      if (S.tenGod(day, (day + k) % 10) !== row[k]) shiftBad++;
    }
  }
  r.ok(shiftBad === 0, '양간 5종·음간 5종이 각각 같은 배열을 따름', `이상 ${shiftBad}건`);

  let parityBad = 0;
  for (let k = 0; k < 10; k += 2) if (YANG[k] !== YIN[k]) parityBad++;
  for (let k = 1; k < 10; k += 2) if (YANG[k] === YIN[k]) parityBad++;
  r.ok(parityBad === 0, '짝수 오프셋은 일치·홀수 오프셋은 상이', `이상 ${parityBad}건`);

  const stages = [[0, 11, '장생'], [0, 6, '사'], [1, 6, '장생'], [6, 5, '장생'], [7, 0, '장생']];
  let stageBad = 0;
  for (const [ds, br, want] of stages) if (S.lifeStage(ds, br) !== want) stageBad++;
  r.ok(stageBad === 0, '십이운성 장생 위치 5종', `이상 ${stageBad}건`);
  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 4) 명식 산출 — 경계 케이스
 * ─────────────────────────────────────────────────────────────────── */
const chart = (o) => S.computeChart({
  hour: 12, minute: 0, gender: 'M', lon: 126.978,
  useSolarTime: true, unknownTime: false, ...o,
});
{
  const r = makeReporter('4) 명식 산출 경계 케이스');

  const before = chart({ year: 1984, month: 2, day: 4, hour: 10 });
  r.ok(before.meta.sajuYear === 1983 && before.pillars.year.ganji === '癸亥',
    '입춘 전은 전년도 년주', `${before.pillars.year.ganji} / 사주년 ${before.meta.sajuYear}`);

  const after = chart({ year: 1984, month: 2, day: 5, hour: 10 });
  r.ok(after.meta.sajuYear === 1984 && after.pillars.year.ganji === '甲子',
    '입춘 후는 당년 년주', `${after.pillars.year.ganji} / 사주년 ${after.meta.sajuYear}`);

  const dst = chart({ year: 1988, month: 7, day: 15, hour: 23, minute: 40, gender: 'F' });
  r.ok(dst.meta.dst === true, '1988-07 서머타임 감지', `보정시각 ${pad(dst.meta.localTime.hour)}:${pad(dst.meta.localTime.minute)}`);

  const oldMeridian = chart({ year: 1957, month: 6, day: 10, hour: 8, lon: 129.075 });
  r.ok(oldMeridian.meta.standardOffset === 8.5, '1957년 표준자오선 UTC+8:30',
    `보정 ${oldMeridian.meta.correctionMinutes}분`);

  const seoul = chart({ year: 1990, month: 5, day: 12, hour: 14, minute: 30 });
  r.ok(seoul.meta.correctionMinutes === -32, '서울 진태양시 보정 −32분',
    `${seoul.meta.correctionMinutes}분`);
  r.ok(seoul.pillars.day.ganji === '丁丑' && seoul.pillars.month.ganji === '辛巳',
    '1990-05-12 14:30 서울 원국',
    [seoul.pillars.year, seoul.pillars.month, seoul.pillars.day, seoul.pillars.hour]
      .map((p) => p.ganji).join(' '));

  const noTime = chart({ year: 2005, month: 11, day: 30, gender: 'F', unknownTime: true });
  r.ok(noTime.pillars.hour === null && noTime.list.length === 3,
    '시각 미상이면 3주만 산출', `${noTime.list.map((p) => p.ganji).join(' ')}`);

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 5) 불변식 — 넓은 범위 무작위
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('5) 불변식 (1900~2100 무작위 2000건)');
  const bad = { elem: 0, god: 0, ratio: 0, strength: 0, luck: 0, age: 0, void: 0 };
  let extremeStrength = 0;
  for (let k = 0; k < 2000; k++) {
    const c = chart({
      year: 1900 + (k * 7) % 200,
      month: 1 + (k * 5) % 12,
      day: 1 + (k * 11) % 28,
      hour: (k * 13) % 24,
      minute: (k * 17) % 60,
      gender: k % 2 ? 'M' : 'F',
    });
    // 오행은 8글자 전부, 십성은 일간을 뺀 7글자
    if (c.elements.reduce((s, e) => s + e.count, 0) !== 8) bad.elem++;
    if (c.godGroups.reduce((s, g) => s + g.count, 0) !== 7) bad.god++;
    if (Math.abs(c.godGroups.reduce((s, g) => s + g.ratio, 0) - 1) > 1e-9) bad.ratio++;
    // 여덟 글자가 전부 비겁·인성이면 drain 이 0 이라 정확히 1 이 된다 (극신강). 유효한 값이다.
    if (!Number.isFinite(c.strength) || c.strength <= 0 || c.strength > 1) bad.strength++;
    if (c.strength === 1) extremeStrength++;
    if (c.luckPillars.length !== 10) bad.luck++;
    if (c.startAge < 1 || c.startAge > 10) bad.age++;
    if (c.voidBranches.length !== 2) bad.void++;
  }
  r.ok(bad.elem === 0, '오행 합 = 8 (여덟 글자 전부)', `이상 ${bad.elem}건`);
  r.ok(bad.god === 0, '십성 합 = 7 (일간 제외)', `이상 ${bad.god}건`);
  r.ok(bad.ratio === 0, '십성 비율 합 = 1', `이상 ${bad.ratio}건`);
  r.ok(bad.strength === 0, '신강도 유한값 0 초과 1 이하', `이상 ${bad.strength}건`);
  r.info(`극신강(신강도 정확히 1) ${extremeStrength}건 — drain 이 0 인 정상 극단값`);
  r.ok(bad.luck === 0, '대운 10개', `이상 ${bad.luck}건`);
  r.ok(bad.age === 0, '대운수 1~10', `이상 ${bad.age}건`);
  r.ok(bad.void === 0, '공망 2지', `이상 ${bad.void}건`);
  failures += r.done();
}

console.log(failures === 0 ? '\n✅ test-saju 전체 통과\n' : `\n❌ test-saju 실패 ${failures}건\n`);
process.exit(failures === 0 ? 0 : 1);
