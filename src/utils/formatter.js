export function singleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Safe inline DOM rendering: code spans first, labelled links before bare URLs.
export function appendSafeInline(node, text, depth=0) {
  if(depth>4) {node.appendChild(document.createTextNode(text));return;}
  const pattern=/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)(?:[^\s<>"'()]|\([^\s<>"'()]*\))+(?:\s+"[^"\n]*")?\)|https?:\/\/[^\s<>"')\]]+)/gi;
  let index=0;
  for(const match of String(text).matchAll(pattern)) {
    node.appendChild(document.createTextNode(String(text).slice(index,match.index)));
    const part=match[0]; let child;
    if(part.startsWith('`')) {child=document.createElement('code');child.className='inline';child.textContent=part.slice(1,-1);}
    else if(part.startsWith('**')) {child=document.createElement('strong');appendSafeInline(child,part.slice(2,-2),depth+1);}
    else {
      const labelled=/^\[([^\]]+)\]\((.+)\)$/.exec(part);
      const href=labelled?labelled[2].replace(/\s+"[^"\n]*"$/,''):part;
      try {
        const url=new URL(href);
        if(!['http:','https:','mailto:'].includes(url.protocol))throw new Error('Unsafe URL');
        child=document.createElement('a');child.href=url.href;child.target='_blank';child.rel='noopener noreferrer';
        // Labels stay inert text; no HTML or nested links are executed.
        child.textContent=labelled?labelled[1]:part;
      }catch{child=document.createTextNode(part);}
    }
    node.appendChild(child);index=match.index+part.length;
  }
  node.appendChild(document.createTextNode(String(text).slice(index)));
}
