import fs from 'node:fs';
import path from 'node:path';

function walk(root, extensions = null) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, extensions));
    else if (!extensions || extensions.some(ext => full.endsWith(ext))) out.push(full);
  }
  return out;
}

const sourceFiles = walk('src', ['.ts', '.tsx']).filter(file => !file.includes('/server/') && !file.includes('\\server\\'));
const calls = new Map();
const fetchRegex = /fetch\(\s*([`'\"])(\/api\/[^`'\"]+)\1/g;
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = fetchRegex.exec(source))) {
    const route = match[2]
      .replace(/\$\{[^}]+\}/g, ':param')
      .replace(/\?.*$/, '');
    const files = calls.get(route) ?? new Set();
    files.add(file.replaceAll('\\', '/'));
    calls.set(route, files);
  }
}

console.log('\n=== FRONTEND API CALLS ===');
for (const [route, files] of [...calls.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${route} <- ${[...files].join(', ')}`);
}

console.log('\n=== CLOUDFLARE FUNCTION FILES ===');
for (const file of walk('functions', ['.js', '.ts']).sort()) console.log(file.replaceAll('\\', '/'));

console.log('\n=== COUNTS ===');
console.log(`Frontend API patterns: ${calls.size}`);
console.log(`Function files: ${walk('functions', ['.js', '.ts']).length}`);
