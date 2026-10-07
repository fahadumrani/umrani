// The same local source owns standalone icon files, static HTML and runtime icons.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ICON_PATHS,iconSvg} from '../src/ui/icons.js';
const root=new URL('../',import.meta.url);
await mkdir(new URL('assets/icons/',root),{recursive:true});
for(const name of Object.keys(ICON_PATHS)) {
 const svg=iconSvg(name,24).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 await writeFile(new URL(`assets/icons/${name}.svg`,root),svg+'\n');
}
const favicon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Umrani AI"><defs><linearGradient id="umrani-gradient" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#7C3AED"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#umrani-gradient)"/><g transform="translate(4 4)" fill="none" color="#FFFFFF" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS.brand}</g></svg>\n`;
await writeFile(new URL('assets/icons/umrani-mark.svg',root),favicon);
const file=new URL('index.html',root);
let html=await readFile(file,'utf8');
html=html.replace(/<svg\b(?=[^>]*data-icon="([\w]+)")[^>]*>[\s\S]*?<\/svg>/g,(svg,name)=>{
 const size=Number(svg.match(/\bwidth="(\d+)"/)?.[1] || 20);
 const classes=(svg.match(/\bclass="([^"]*)"/)?.[1] || '').split(/\s+/).filter(x=>x!=='ui-icon').join(' ');
 return iconSvg(name,size,classes);
});
await writeFile(file,html);
