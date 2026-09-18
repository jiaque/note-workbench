import { readFile, readdir, writeFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
let output = '# Third-party notices\n\nGenerated from package-lock.json for local development. Project-owned code remains UNLICENSED until its owner selects a public license.\n\n';
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev) continue;
  const pkg = JSON.parse(await readFile(location + '/package.json', 'utf8'));
  output += `## ${pkg.name} ${pkg.version}\n\nLicense: ${pkg.license || 'See package distribution'}\n\n`;
  for (const file of (await readdir(location)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))) {
    try { const content = await readFile(location + '/' + file, 'utf8'); output += `### ${file}\n\n\u0060\u0060\u0060text\n${content}\n\u0060\u0060\u0060\n\n`; } catch { /* A matching directory is not a license text. */ }
  }
}
await writeFile('THIRD_PARTY_NOTICES.md', output.trimEnd() + '\n');
console.log('Generated third-party notices for production dependencies.');
