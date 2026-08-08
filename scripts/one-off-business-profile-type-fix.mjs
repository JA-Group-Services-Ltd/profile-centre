import fs from 'node:fs';

const path = 'src/pages/dashboard/business-profile.tsx';
let source = fs.readFileSync(path, 'utf8');
const find = `      // Re-sync all form state from the server response so nothing appears lost on save\n      const saved_p: BizProfile = data.data;`;
const replace = `      // Re-sync all form state from the server response so nothing appears lost on save.\n      // A successful HTTP status without a profile payload is still an invalid save response.\n      if (!data.success || !data.data) {\n        throw new Error(data.error || 'The server did not return the saved business profile.');\n      }\n      const saved_p: BizProfile = data.data;`;
if (!source.includes(find)) throw new Error('Expected business profile save fragment was not found.');
source = source.replace(find, replace);
fs.writeFileSync(path, source);
console.log('Business profile response guard applied.');
