import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const files = process.argv.slice(2);
if (!files.length) files.push('README.md');
const errors = [];
for (const file of files) {
 const source = await readFile(file, 'utf8');
 for (const match of source.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
  const link = match[1].replace(/^<|>$/g, '');
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(link)) continue;
  const target = decodeURIComponent(link.split(/[?#]/)[0]);
  if (!target) continue;
  try { await access(resolve(dirname(file), target)); }
  catch { errors.push(file + ': missing ' + target); }
 }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Local Markdown file links valid: ' + files.join(', '));
