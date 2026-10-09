import { readFile, writeFile } from 'node:fs/promises';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const [html, css, domain, app] = await Promise.all(['src/template.html', 'src/styles.css', 'src/domain.js', 'src/app.js'].map(read));
await writeFile(new URL('../demo.html', import.meta.url), html.replace('/* STYLES */', css).replace('/* APPLICATION */', () => domain.replace(/^export /gm, '') + '\n' + app));
console.log('Built demo.html — self-contained, no network dependencies.');
