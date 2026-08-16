/* 명암비 검증
 *   node tools/contrast-check.mjs
 *
 * style.css 의 토큰을 실제로 파싱해 WCAG 2.1 명암비를 계산한다.
 * 눈대중이 아니라 수치로 막는 것이 목적이다.
 *   본문·라벨 텍스트  4.5:1 이상 (AA)
 *   대형 글자·도형    3.0:1 이상 (AA Large / Non-text)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './_load.mjs';

const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'style.css'), 'utf8');

/* ── CSS 토큰 추출 ─────────────────────────────────────────────────── */
function block(selector) {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`셀렉터를 찾지 못했습니다: ${selector}`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}
function tokens(selector) {
  const out = {};
  for (const m of block(selector).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    out['--' + m[1]] = m[2].trim();
  }
  return out;
}

const LIGHT = tokens(':root {');
const DARK = { ...LIGHT, ...tokens(':root[data-theme="dark"]') };

/* ── 색 파싱 · 합성 · 명암비 ───────────────────────────────────────── */
function parseColor(v) {
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  }
  return null; // color-mix() 등은 검사 대상에서 제외
}

/** 반투명 전경색을 불투명 배경 위에 합성한다 */
function composite(fg, bg) {
  return {
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg, bg) {
  const a = luminance(composite(fg, bg)) + 0.05;
  const b = luminance(bg) + 0.05;
  return a > b ? a / b : b / a;
}

/* ── 검사 대상 ─────────────────────────────────────────────────────── */
// role: 'text' = 4.5:1, 'large' = 3:1
const CHECKS = [
  { token: '--ink', role: 'text', on: ['--paper', '--paper-2', '--paper-3'], note: '본문' },
  { token: '--ink-strong', role: 'text', on: ['--paper', '--paper-2', '--paper-3'], note: '본문 보조' },
  { token: '--ink-muted', role: 'text', on: ['--paper', '--paper-2', '--paper-3'], note: '라벨·캡션' },
  { token: '--ink-faint', role: 'large', on: ['--paper', '--paper-2'], note: '장식 (본문 사용 금지)' },
  { token: '--wood', role: 'large', on: ['--paper', '--paper-2'], note: '오행 한자' },
  { token: '--fire', role: 'large', on: ['--paper', '--paper-2'], note: '오행 한자' },
  { token: '--earth', role: 'large', on: ['--paper', '--paper-2'], note: '오행 한자' },
  { token: '--metal', role: 'large', on: ['--paper', '--paper-2'], note: '오행 한자' },
  { token: '--water', role: 'large', on: ['--paper', '--paper-2'], note: '오행 한자' },
  { token: '--inverse-fg', role: 'text', on: ['--inverse-bg'], note: '반전 블록 본문' },
];

const MIN = { text: 4.5, large: 3.0 };

let failed = 0;
for (const [themeName, T] of [['밝은 테마', LIGHT], ['어두운 테마', DARK]]) {
  console.log(`\n=== ${themeName} ===`);
  for (const check of CHECKS) {
    const fgRaw = T[check.token];
    if (!fgRaw) { console.log(`  SKIP  ${check.token} — 정의 없음`); continue; }
    const fg = parseColor(fgRaw);
    if (!fg) { console.log(`  SKIP  ${check.token} — 파싱 불가 (${fgRaw})`); continue; }

    for (const bgToken of check.on) {
      const bg = parseColor(T[bgToken]);
      if (!bg) continue;
      const ratio = contrast(fg, bg);
      const min = MIN[check.role];
      const ok = ratio >= min;
      if (!ok) failed++;
      console.log(
        `  ${ok ? 'PASS' : 'FAIL'}  ${check.token.padEnd(14)} on ${bgToken.padEnd(11)}` +
        ` ${ratio.toFixed(2).padStart(5)}:1  (필요 ${min.toFixed(1)})  ${check.note}`,
      );
    }
  }
}

console.log(
  failed === 0
    ? '\n✅ 명암비 전체 통과\n'
    : `\n❌ 명암비 기준 미달 ${failed}건 — assets/css/style.css 토큰을 조정하세요\n`,
);
process.exit(failed === 0 ? 0 : 1);
