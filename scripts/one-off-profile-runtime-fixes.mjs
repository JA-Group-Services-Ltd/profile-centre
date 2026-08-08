import fs from 'node:fs';

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [find, replace] of replacements) {
    if (!source.includes(find)) throw new Error(`Expected fragment not found in ${path}: ${find.slice(0, 100)}`);
    source = source.replaceAll(find, replace);
  }
  fs.writeFileSync(path, source);
}

patch('src/pages/profile.tsx', [
  ['gallery?: string | null;', 'gallery?: string | GalleryItem[] | null;'],
  ['menu_items?: string | null;', 'menu_items?: string | MenuItem[] | null;'],
  ['pdf_attachments?: string | null;', 'pdf_attachments?: string | DocumentItem[] | null;'],
  ['social_links?: string | null;', 'social_links?: string | SimpleSocialLink[] | null;'],
  [
    `function parseArray<T>(value: string | null | undefined): T[] {\n  if (!value) return [];\n  try {\n    const parsed = JSON.parse(value);\n    return Array.isArray(parsed) ? parsed : [];\n  } catch {\n    return [];\n  }\n}`,
    `function parseArray<T>(value: string | T[] | null | undefined): T[] {\n  if (Array.isArray(value)) return value;\n  if (!value) return [];\n  try {\n    const parsed = JSON.parse(value);\n    return Array.isArray(parsed) ? parsed : [];\n  } catch {\n    return [];\n  }\n}`,
  ],
  ['href={`tel:${encodeURIComponent(profile.phone)}`}', "href={`tel:${profile.phone.replace(/[^\\d+*#;,]/g, '')}`}"],
]);

patch('src/pages/dashboard/profile.tsx', [
  ['https://japrofilestudio.jagroupservices.co.uk/dashboard/profile', 'https://sousamurrayprofiles.jagroupservices.co.uk/dashboard/profile'],
]);

patch('src/pages/admin/profiles.tsx', [
  ['https://japrofilestudio.jagroupservices.co.uk/profile/${p.username}', 'https://sousamurrayprofiles.jagroupservices.co.uk/profile/${p.username}'],
]);

console.log('Profile runtime consistency fixes applied.');
