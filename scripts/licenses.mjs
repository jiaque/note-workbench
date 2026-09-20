import { readFile, readdir, writeFile } from 'node:fs/promises';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
let output = '# Third-party notices\n\nGenerated from package-lock.json. Project-owned code is licensed under Apache-2.0; see LICENSE. Third-party components retain their respective licenses and notices below.\n\n';
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location || entry.dev) continue;
  let pkg;
  try {pkg=JSON.parse(await readFile(location + '/package.json', 'utf8'));}
  catch(error){if(entry.optional&&error.code==='ENOENT')continue;throw error;}
  output += `## ${pkg.name} ${pkg.version}\n\nLicense: ${pkg.license || 'See package distribution'}\n\n`;
  for (const file of (await readdir(location)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))) {
    try { const content = await readFile(location + '/' + file, 'utf8'); output += `### ${file}\n\n\u0060\u0060\u0060text\n${content}\n\u0060\u0060\u0060\n\n`; } catch { /* A matching directory is not a license text. */ }
  }
  if(pkg.name==='pdfjs-dist')for(const directory of ['cmaps','standard_fonts','wasm'])for(const file of (await readdir(location+'/'+directory)).filter(name=>/licen[cs]e|copying|notice/i.test(name))){
    const content=await readFile(location+'/'+directory+'/'+file,'utf8');output+=`### ${directory}/${file}\n\n\u0060\u0060\u0060text\n${content}\n\u0060\u0060\u0060\n\n`;
  }
}
await writeFile('THIRD_PARTY_NOTICES.md', output.replace(/\r\n/g,'\n').replace(/[\t ]+$/gm,'').trimEnd() + '\n');
console.log('Generated third-party notices for production dependencies.');
