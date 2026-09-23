import fs from 'node:fs';
const result = {};
for (const f of fs.readdirSync('src/seed/data').filter(f => f.endsWith('.ts'))) result[f] = await import('../src/seed/data/' + f);
const json = JSON.stringify(result);
if (process.argv[2] === 'before') fs.writeFileSync('.tmp-text/seed-before.json', json);
else { if (json !== fs.readFileSync('.tmp-text/seed-before.json', 'utf8')) throw new Error('Seed data changed'); console.log('All exported seed data unchanged.'); }
