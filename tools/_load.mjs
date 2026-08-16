/* 브라우저용 IIFE 스크립트들을 Node 에서 불러오기 위한 공용 로더.
 * 각 스크립트는 window.<Name> 에 자신을 붙이므로, 가짜 window 를 만들어 평가한다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
const JS = path.join(ROOT, 'assets', 'js');

export function loadBrowserModules(files = ['calendar.js', 'data.js', 'saju.js']) {
  const win = {};
  globalThis.window = win;
  for (const f of files) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    // 브라우저 스크립트는 (function(global){...})(window) 형태라 eval 로 충분하다
    (0, eval)(src);
  }
  return win;
}

export const pad = (n) => String(n).padStart(2, '0');

/* UT 기준 율리우스일 -> 한국 표준시 문자열 */
export function fmtKST(A, jdUT) {
  const t = A.fromJD(jdUT + 9 / 24);
  return `${t.y}-${pad(t.m)}-${pad(t.d)} ${pad(t.hour)}:${pad(t.minute)}`;
}

/* 'YYYY-MM-DD HH:MM' (KST) -> UT 기준 율리우스일 */
export function parseKST(A, s) {
  const [d, tm] = s.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = tm.split(':').map(Number);
  return A.toJD(y, mo, da) + (h + mi / 60) / 24 - 9 / 24;
}

/* 통과/실패 집계 */
export function makeReporter(title) {
  let pass = 0, fail = 0;
  console.log(`\n=== ${title} ===`);
  return {
    ok(cond, label, detail = '') {
      if (cond) { pass++; console.log(`  PASS  ${label}${detail ? '  ' + detail : ''}`); }
      else { fail++; console.log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`); }
    },
    info(msg) { console.log(`        ${msg}`); },
    done() {
      console.log(`  → ${pass} passed, ${fail} failed`);
      return fail;
    },
  };
}
