import fs from 'node:fs';

function patch(path, transforms) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  for (const [find, replace] of transforms) {
    if (!source.includes(find)) throw new Error(`Expected source fragment not found in ${path}: ${find.slice(0, 120)}`);
    source = source.replaceAll(find, replace);
  }
  if (source === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, source);
}

patch('src/pages/admin/settings.tsx', [
  [
    'BookOpen, FileDown, Database, HardDrive, Download, Calendar, RotateCcw,',
    'BookOpen, FileDown, Database, HardDrive, Download, Calendar, RotateCcw, ChevronRight,',
  ],
]);

patch('src/pages/dashboard/business-cards.tsx', [
  ['data[addon.key]', 'data[addon.key as keyof BuilderData]'],
  ['set(addon.key, e.target.checked)', 'set(addon.key as keyof BuilderData, e.target.checked)'],
]);

patch('src/pages/dashboard/overview.tsx', [
  [
    "{'suffix' in stat && <span className=\"text-lg\">{stat.suffix}</span>}",
    "{'suffix' in stat && <span className=\"text-lg\">{String(stat.suffix ?? '')}</span>}",
  ],
  [
    'japrofilestudio.jagroupservices.co.uk${getProfilePath(businessProfile)}',
    'sousamurrayprofiles.jagroupservices.co.uk${getProfilePath(businessProfile)}',
  ],
]);

console.log('Active customer/admin page fixes applied.');
