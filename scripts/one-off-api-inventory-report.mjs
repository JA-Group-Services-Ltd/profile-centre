import fs from 'node:fs';
import path from 'node:path';

function walk(root, extensions = null) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, extensions));
    else if (!extensions || extensions.some(ext => full.endsWith(ext))) out.push(full.replaceAll('\\', '/'));
  }
  return out;
}

const sourceFiles = walk('src', ['.ts', '.tsx'])
  .filter(file => !file.includes('/server/'));
const calls = new Map();
const fetchRegex = /fetch\(\s*([`'\"])(\/api\/[^`'\"]+)\1/g;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = fetchRegex.exec(source))) {
    const raw = match[2].replace(/\?.*$/, '');
    const route = raw.replace(/\$\{[^}]+\}/g, ':param');
    const files = calls.get(route) ?? new Set();
    files.add(file);
    calls.set(route, files);
  }
}

const retired = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  if (/japrofilestudio\.jagroupservices\.co\.uk/i.test(source)) retired.push(file);
}

const functionFiles = walk('functions', ['.js', '.ts']).sort();
const lines = [];
lines.push('SOUSA MURRAY PROFILES API INVENTORY');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('=== FRONTEND API CALLS ===');
for (const [route, files] of [...calls.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  lines.push(`${route} <- ${[...files].join(', ')}`);
}
lines.push('');
lines.push('=== CLOUDFLARE FUNCTION FILES ===');
for (const file of functionFiles) lines.push(file);
lines.push('');
lines.push('=== RETIRED JA PROFILE STUDIO HOST REFERENCES IN FRONTEND ===');
if (retired.length) retired.forEach(file => lines.push(file));
else lines.push('None');
lines.push('');
lines.push('=== COUNTS ===');
lines.push(`Frontend API patterns: ${calls.size}`);
lines.push(`Function files: ${functionFiles.length}`);
lines.push(`Retired host frontend files: ${retired.length}`);
lines.push('');

fs.writeFileSync('api-inventory-report.txt', `${lines.join('\n')}\n`);
console.log(`Wrote ${calls.size} API patterns and ${functionFiles.length} Function files.`);
