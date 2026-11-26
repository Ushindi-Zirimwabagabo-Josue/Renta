// Lists every UI string passed to t('…') or tk('…') so translations can be checked.
// Usage: node scripts/extract-strings.mjs [--missing rw|fr]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? (f !== 'i18n' && walk(p)) : /\.tsx?$/.test(f) && !/\.test\./.test(f) && files.push(p); });
walk('src');
const keys = new Set();
const re = /\btk?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const plural = /\btn\([^,]+,\s*'([^']*)',\s*'([^']*)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) keys.add(m[2].replace(/\\(['"\\])/g, '$1'));
  for (const m of src.matchAll(plural)) keys.add(m[1]).add(m[2]);
}
const list = [...keys].sort();
const i = process.argv.indexOf('--missing');
if (i > 0) {
  const lang = process.argv[i + 1];
  const src = readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  const dict = new Function(src.replace(/^export const \w+: Record<string, string> = /m, 'return ').replace(/;\s*$/, ''))();
  const missing = list.filter((k) => !(k in dict));
  console.log(JSON.stringify(missing, null, 2));
  console.error(`${missing.length} of ${list.length} strings missing in ${lang}`);
} else console.log(JSON.stringify(list, null, 2));
