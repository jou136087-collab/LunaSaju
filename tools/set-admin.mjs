/* 관리자 UID 등록
 *   node tools/set-admin.mjs                 로그인한 사용자가 1명이면 그 사람을 등록
 *   node tools/set-admin.mjs you@gmail.com   여러 명이면 이메일로 지정
 *   node tools/set-admin.mjs --show          현재 등록 상태만 보기
 *
 * 관리자 권한은 두 곳에 같이 적어야 한다.
 *   firebase-config.js → 화면에 관리 메뉴를 띄울지 (클라이언트가 고칠 수 있으므로 신뢰하지 않음)
 *   firestore.rules    → 실제 권한 (이쪽이 진짜)
 * 한쪽만 고치면 "메뉴는 보이는데 데이터가 안 오는" 상태가 되므로 이 스크립트로 함께 바꾼다.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ROOT } from './_load.mjs';

const CONFIG = path.join(ROOT, 'assets', 'js', 'firebase-config.js');
const RULES = path.join(ROOT, 'firestore.rules');

const CONFIG_RE = /adminUids:\s*\[[^\]]*\]/;
const RULES_RE = /(function adminUids\(\)\s*\{\s*return\s*)\[[^\]]*\](\s*;\s*\})/;

function readUids() {
  const cfg = fs.readFileSync(CONFIG, 'utf8').match(CONFIG_RE);
  const rul = fs.readFileSync(RULES, 'utf8').match(RULES_RE);
  const pick = (s) => (s ? [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]) : []);
  return {
    config: pick(cfg && cfg[0]),
    rules: pick(rul && (rul[0] || '')),
  };
}

function show() {
  const { config, rules } = readUids();
  console.log('\n현재 등록 상태');
  console.log('  firebase-config.js :', config.length ? config.join(', ') : '(비어 있음)');
  console.log('  firestore.rules    :', rules.length ? rules.join(', ') : '(비어 있음)');
  const same = config.length === rules.length && config.every((u) => rules.includes(u));
  console.log(same ? '  → 두 곳이 일치합니다.' : '  ⚠ 두 곳이 다릅니다. 이 스크립트를 인자 없이 다시 실행하세요.');
  return same;
}

if (process.argv.includes('--show')) { show(); process.exit(0); }

/* ── 로그인한 사용자 가져오기 ─────────────────────────────────────── */
const tmp = path.join(os.tmpdir(), `lune-users-${Date.now()}.json`);
let users = [];
try {
  execFileSync('firebase', ['auth:export', tmp, '--project', 'lune-saju', '--format', 'json'], {
    stdio: ['ignore', 'pipe', 'pipe'], shell: true,
  });
  users = JSON.parse(fs.readFileSync(tmp, 'utf8')).users || [];
} catch (e) {
  console.error('❌ firebase auth:export 실패 — firebase CLI 로그인 상태를 확인하세요.');
  console.error(String(e.stderr || e.message).trim().split('\n').slice(-3).join('\n'));
  process.exit(1);
} finally {
  fs.rmSync(tmp, { force: true });
}

if (!users.length) {
  console.error('\n❌ 로그인한 사용자가 아직 없습니다.');
  console.error('   https://lune-saju.web.app 에서 사이드바의 "구글로 로그인" 을 한 번 누른 뒤 다시 실행하세요.\n');
  process.exit(1);
}

const wanted = process.argv[2];
let target;
if (wanted) {
  target = users.find((u) => u.email === wanted || u.localId === wanted);
  if (!target) {
    console.error(`\n❌ "${wanted}" 에 해당하는 사용자가 없습니다. 등록된 계정:`);
    users.forEach((u) => console.error(`   ${u.email || '(이메일 없음)'}  ${u.localId}`));
    process.exit(1);
  }
} else if (users.length === 1) {
  target = users[0];
} else {
  console.error('\n❌ 사용자가 여러 명입니다. 이메일을 인자로 지정하세요:');
  users.forEach((u) => console.error(`   node tools/set-admin.mjs ${u.email}`));
  process.exit(1);
}

const uid = target.localId;

/* ── 두 파일 함께 수정 ────────────────────────────────────────────── */
let cfg = fs.readFileSync(CONFIG, 'utf8');
if (!CONFIG_RE.test(cfg)) {
  console.error('❌ firebase-config.js 에서 adminUids 를 찾지 못했습니다.');
  process.exit(1);
}
cfg = cfg.replace(CONFIG_RE, `adminUids: ['${uid}']`);
fs.writeFileSync(CONFIG, cfg);

let rul = fs.readFileSync(RULES, 'utf8');
if (!RULES_RE.test(rul)) {
  console.error('❌ firestore.rules 에서 adminUids() 를 찾지 못했습니다.');
  process.exit(1);
}
rul = rul.replace(RULES_RE, `$1['${uid}']$2`);
fs.writeFileSync(RULES, rul);

console.log(`\n✅ 관리자로 등록했습니다 — ${target.email || '(이메일 없음)'}`);
console.log(`   UID ${uid}`);
show();
console.log('\n다음: 배포해야 실제로 적용됩니다.');
console.log('   firebase deploy\n');
