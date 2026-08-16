/* Firestore 보안 규칙 검증
 *   npm run test:rules
 *   (내부적으로: firebase emulators:exec --only firestore -- node tools/test-rules.mjs)
 *
 * 규칙이 잘못되면 방문자 명단이 통째로 새거나 앱이 아예 못 쓰게 된다.
 * "막혀야 하는 것"과 "통해야 하는 것"을 둘 다 검사한다.
 *
 * 이 테스트만 @firebase/rules-unit-testing 과 firebase-tools 가 필요하다.
 * 다른 검증 스크립트는 의존성 없이 그대로 돈다.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, increment,
} from 'firebase/firestore';
import { ROOT, makeReporter } from './_load.mjs';

const ADMIN = 'admin-uid-0001';
const ALICE = 'alice-uid-0002';
const BOB = 'bob-uid-0003';

/* 규칙 파일의 adminUids() 를 테스트용 UID 로 바꿔서 올린다.
 * (배포본은 비어 있는 것이 정상이므로 원본을 건드리지 않는다) */
let rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const before = rules;
rules = rules.replace(
  /function adminUids\(\)\s*\{\s*return\s*\[[^\]]*\];\s*\}/,
  `function adminUids() { return ['${ADMIN}']; }`,
);
if (rules === before) {
  console.error('❌ firestore.rules 의 adminUids() 를 찾지 못했습니다. 규칙 파일 구조가 바뀌었는지 확인하세요.');
  process.exit(1);
}

const env = await initializeTestEnvironment({
  projectId: 'demo-lune',
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

const admin = env.authenticatedContext(ADMIN).firestore();
const alice = env.authenticatedContext(ALICE).firestore();
const bob = env.authenticatedContext(BOB).firestore();
const guest = env.unauthenticatedContext().firestore();

const ok = (p) => assertSucceeds(p).then(() => true, () => false);
const no = (p) => assertFails(p).then(() => true, () => false);

let failures = 0;

/* ─────────────────────────────────────────────────────────────────────
 * 1) 사용자 문서 — 본인만
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('1) users — 소유자 격리');

  r.ok(await ok(setDoc(doc(alice, 'users', ALICE), {
    displayName: '앨리스', email: 'a@x.com', photoURL: '', visits: 0,
  })), '본인 문서 생성 허용');

  r.ok(await no(setDoc(doc(bob, 'users', ALICE), { displayName: '침입' })),
    '남의 문서 쓰기 차단');

  r.ok(await no(getDoc(doc(bob, 'users', ALICE))), '남의 문서 읽기 차단');
  r.ok(await ok(getDoc(doc(alice, 'users', ALICE))), '본인 문서 읽기 허용');
  r.ok(await no(getDoc(doc(guest, 'users', ALICE))), '비로그인 읽기 차단');

  r.ok(await ok(setDoc(doc(alice, 'users', ALICE),
    { profile: { year: 1990, month: 5, day: 12 } }, { merge: true })),
    '본인 프로필 저장 허용');

  // 화이트리스트 밖 필드는 막아야 한다 (임의 데이터 주입 방지)
  r.ok(await no(setDoc(doc(alice, 'users', ALICE), { role: 'admin' }, { merge: true })),
    '정의되지 않은 필드(role) 주입 차단');

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 2) 방문자 명단 — 관리자만
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('2) users 목록 — 관리자 전용');

  await setDoc(doc(bob, 'users', BOB), { displayName: '밥', email: 'b@x.com', visits: 0 });

  r.ok(await no(getDocs(collection(alice, 'users'))), '일반 사용자의 명단 조회 차단');
  r.ok(await no(getDocs(collection(guest, 'users'))), '비로그인 명단 조회 차단');
  r.ok(await ok(getDocs(collection(admin, 'users'))), '관리자 명단 조회 허용');
  r.ok(await ok(getDoc(doc(admin, 'users', ALICE))), '관리자 개별 조회 허용');
  r.ok(await no(setDoc(doc(admin, 'users', ALICE), { displayName: '관리자수정' }, { merge: true })),
    '관리자도 남의 문서 수정은 차단 (읽기 전용)');

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 3) 저장한 명식 — 하위 컬렉션
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('3) users/{uid}/charts');

  r.ok(await ok(setDoc(doc(alice, 'users', ALICE, 'charts', 'c1'), { year: 1990 })),
    '본인 명식 저장 허용');
  r.ok(await no(getDoc(doc(bob, 'users', ALICE, 'charts', 'c1'))),
    '남의 명식 읽기 차단');
  r.ok(await no(getDoc(doc(admin, 'users', ALICE, 'charts', 'c1'))),
    '관리자도 남의 명식 본문은 차단');

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 4) 방문 카운터 — 비로그인 +1 만
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('4) stats — 카운터');

  r.ok(await ok(setDoc(doc(guest, 'stats', 'global'),
    { count: increment(1), updatedAt: new Date() }, { merge: true })),
    '비로그인 최초 생성(=1) 허용');

  r.ok(await ok(setDoc(doc(guest, 'stats', 'global'),
    { count: increment(1), updatedAt: new Date() }, { merge: true })),
    '비로그인 +1 허용');

  r.ok(await no(setDoc(doc(guest, 'stats', 'global'),
    { count: increment(500), updatedAt: new Date() }, { merge: true })),
    '한 번에 크게 부풀리기(+500) 차단');

  r.ok(await no(setDoc(doc(guest, 'stats', 'global'),
    { count: 999999, updatedAt: new Date() }, { merge: true })),
    '임의 값 덮어쓰기 차단');

  r.ok(await no(setDoc(doc(guest, 'stats', 'global'),
    { count: increment(1), updatedAt: new Date(), evil: 'x' }, { merge: true })),
    '카운터 문서에 다른 필드 끼워넣기 차단');

  r.ok(await no(getDoc(doc(guest, 'stats', 'global'))), '비로그인 방문 수 읽기 차단');
  r.ok(await no(getDoc(doc(alice, 'stats', 'global'))), '일반 사용자 방문 수 읽기 차단');
  r.ok(await ok(getDoc(doc(admin, 'stats', 'global'))), '관리자 방문 수 읽기 허용');

  r.ok(await no(deleteDoc(doc(admin, 'stats', 'global'))), '카운터 삭제는 관리자도 차단');

  failures += r.done();
}

/* ─────────────────────────────────────────────────────────────────────
 * 5) 그 밖의 경로는 전부 차단
 * ─────────────────────────────────────────────────────────────────── */
{
  const r = makeReporter('5) 미정의 경로');

  r.ok(await no(setDoc(doc(admin, 'anything', 'x'), { a: 1 })), '관리자도 미정의 컬렉션 쓰기 차단');
  r.ok(await no(getDoc(doc(alice, 'secrets', 'x'))), '미정의 컬렉션 읽기 차단');

  failures += r.done();
}

await env.cleanup();

console.log(failures === 0 ? '\n✅ test-rules 전체 통과\n' : `\n❌ test-rules 실패 ${failures}건\n`);
process.exit(failures === 0 ? 0 : 1);
