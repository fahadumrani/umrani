// Safe mathematical plotting inside the app, not executable AI-generated code.
export function quadraticData(spec) {
  if (!spec || spec.type !== 'quadratic') throw new Error('Only quadratic plots are supported');
  const a = Number(spec.a ?? 1), b = Number(spec.b ?? 0), c = Number(spec.c ?? 0);
  const xMin = Number(spec.xMin ?? -5), xMax = Number(spec.xMax ?? 5);
  if (![a,b,c,xMin,xMax].every(Number.isFinite) || a === 0 || Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) > 1e6 || xMin >= xMax || Math.max(Math.abs(xMin),Math.abs(xMax)) > 1e4) throw new Error('Invalid quadratic coefficients/range');
  const evaluate = (x) => a*x*x+b*x+c;
  const points = Array.from({ length: 201 }, (_, i) => { const x = xMin + (xMax-xMin)*i/200; return { x, y: evaluate(x) }; });
  const vertexX = -b/(2*a), vertexY = evaluate(vertexX);
  if (!Number.isFinite(vertexX) || !Number.isFinite(vertexY) || points.some(p => !Number.isFinite(p.y))) throw new Error("Nonfinite quadratic geometry");
  const ys = points.map((point) => point.y);
  if (vertexX >= xMin && vertexX <= xMax) ys.push(vertexY);
  const low = Math.min(0,...ys), high = Math.max(0,...ys);
  const padding = Math.max((high-low)*0.12, Math.abs(high)*Number.EPSILON*8, Math.abs(low)*Number.EPSILON*8);
  if (!(padding > 0) || !Number.isFinite(padding)) throw new Error("Quadratic values are too small to plot reliably");
  const rawStep = (high-low+2*padding)/4;
  const magnitude = 10**Math.floor(Math.log10(rawStep));
  let yStep = [1,2,5,10].map((factor)=>factor*magnitude).find((step)=>step>=rawStep);
  let yMin=Math.floor((low-padding)/yStep)*yStep, yMax=Math.ceil((high+padding)/yStep)*yStep;
  if(Math.round((yMax-yMin)/yStep)+1>6){yStep*=2;yMin=Math.floor((low-padding)/yStep)*yStep;yMax=Math.ceil((high+padding)/yStep)*yStep;}
  if (![yStep,yMin,yMax].every(Number.isFinite) || yStep <= 0 || yMin >= yMax) throw new Error("Invalid plot scale");
  const aText = a === 1 ? '' : a === -1 ? '−' : String(a);
  const bText = b === 0 ? '' : ` ${b<0?'−':'+'} ${Math.abs(b)===1?'':Math.abs(b)}x`;
  const cText = c === 0 ? '' : ` ${c<0?'−':'+'} ${Math.abs(c)}`;
  const formula = `y = ${aText}x²${bText}${cText}`;
  return { points, a,b,c,xMin,xMax,yMin,yMax,yStep,vertexX,vertexY,formula };
}
const plotSvgNS = 'http://www.w3.org/2000/svg';
function plotNode(tag, attrs, text) {
  const element = document.createElementNS(plotSvgNS, tag);
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
export function createQuadraticPlot(code) {
  const wrapper = document.createElement('figure'); wrapper.className = 'function-plot';
  try {
    if (String(code).length > 4096) throw new Error('Plot specification is too large');
    const data = quadraticData(JSON.parse(code));
    const caption = document.createElement('figcaption'); caption.textContent = data.formula; wrapper.appendChild(caption);
    const svg = plotNode('svg', { viewBox:'0 0 640 400', role:'img', 'aria-label': `${data.formula}; x from ${data.xMin} to ${data.xMax}; vertex (${data.vertexX}, ${data.vertexY}). Computed function, not observed data.` });
    const left=80, right=610, top=24, bottom=340;
    const xMap=(x)=>left+(x-data.xMin)/(data.xMax-data.xMin)*(right-left);
    const yMap=(y)=>bottom-(y-data.yMin)/(data.yMax-data.yMin)*(bottom-top);
    const xZero=xMap(Math.min(data.xMax,Math.max(data.xMin,0))), yZero=yMap(0);
    for (let i=0;i<=5;i++) {
      const x=data.xMin+(data.xMax-data.xMin)*i/5;
      svg.appendChild(plotNode('line',{x1:xMap(x),y1:top,x2:xMap(x),y2:bottom,class:'plot-grid'}));
      svg.appendChild(plotNode('text',{x:xMap(x),y:bottom+24,'text-anchor':'middle',class:'plot-tick'},formatPlotTick(x, (data.xMax-data.xMin)/5)));
    }
    const yTicks=Math.round((data.yMax-data.yMin)/data.yStep);
    for(let i=0;i<=yTicks;i++) {
      const y=data.yMin+i*data.yStep;
      svg.appendChild(plotNode('line',{x1:left,y1:yMap(y),x2:right,y2:yMap(y),class:'plot-grid'}));
      svg.appendChild(plotNode('text',{x:left-8,y:yMap(y)+5,'text-anchor':'end',class:'plot-tick'},formatPlotTick(y, data.yStep)));
    }
    svg.appendChild(plotNode('line',{x1:left,y1:yZero,x2:right,y2:yZero,class:'plot-axis'}));
    svg.appendChild(plotNode('line',{x1:xZero,y1:top,x2:xZero,y2:bottom,class:'plot-axis'}));
    svg.appendChild(plotNode('text',{x:right,y:bottom+42,'text-anchor':'end',class:'plot-label'},'x'));
    svg.appendChild(plotNode('text',{x:left-64,y:top+12,'text-anchor':'middle',class:'plot-label'},'y'));
    const path=data.points.map((point,i)=>`${i?'L':'M'}${xMap(point.x).toFixed(3)},${yMap(point.y).toFixed(3)}`).join(' ');
    if (/NaN|Infinity/.test(path)) throw new Error('Nonfinite plot geometry');
    svg.appendChild(plotNode('path',{d:path,class:'plot-curve',fill:'none'}));
    wrapper.appendChild(svg);
    const fitLabels = () => {
      const width = svg.getBoundingClientRect().width;
      if (width > 0) svg.style.fontSize = (12 * 640 / width) + "px";
    };
    requestAnimationFrame(fitLabels);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => { if (!wrapper.isConnected) observer.disconnect(); else fitLabels(); });
      observer.observe(wrapper);
    }
    const note=document.createElement('p'); note.className='plot-note'; note.textContent=`Computed quadratic curve. Vertex: (${Number(data.vertexX.toPrecision(4))}, ${Number(data.vertexY.toPrecision(4))}).`; wrapper.appendChild(note);
  } catch (error) { wrapper.textContent='Could not plot: '+error.message; wrapper.classList.add('diagram-error'); }
  return wrapper;
}

// Arithmetic is parsed as polynomial coefficients, never executed as JavaScript.
export function parseQuadraticExpression(value) {
  const text = String(value).replace(/²/g, '^2').replace(/[−–]/g, '-').toLowerCase();
  if (text.length > 500) throw new Error('Expression is too long');
  const tokens = []; let pos=0;
  while(pos < text.length) {
    if (/\s/.test(text[pos])) { pos++; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/.exec(text.slice(pos));
    if (number) { tokens.push(Number(number[0])); pos+=number[0].length; continue; }
    if ('x+-*/^()'.includes(text[pos])) { tokens.push(text[pos++]); continue; }
    throw new Error('Unsupported expression');
  }
  let index=0;
  const bounded = p => { if(p.some(v=>!Number.isFinite(v) || Math.abs(v)>1e12)) throw new Error('Invalid coefficients'); return p; };
  const add = (p,q,sign=1) => bounded(p.map((v,i)=>v+sign*q[i]));
  const multiply = (p,q) => {
    const out=[0,0,0,0,0]; p.forEach((v,i)=>q.forEach((w,j)=>out[i+j]+=v*w));
    if(out[3] !== 0 || out[4] !== 0) throw new Error('Only degree two polynomials are supported');
    return bounded(out.slice(0,3));
  };
  const primary = () => {
    const token=tokens[index++];
    if(typeof token==='number') return bounded([token,0,0]);
    if(token==='x') return [0,1,0];
    if(token==='(') { const result=expression(); if(tokens[index++]!==')')throw new Error('Unbalanced parentheses'); return result; }
    throw new Error('Missing operand');
  };
  const power = () => {
    let result=primary();
    if(tokens[index]==='^') {
      index++; const exponent=tokens[index++];
      if(!Number.isInteger(exponent)||exponent<0||exponent>2) throw new Error('Unsupported exponent');
      result=exponent===0?[1,0,0]:exponent===1?result:multiply(result,result);
    }
    return result;
  };
  const unary = () => {
    if(tokens[index]==='+') { index++; return unary(); }
    if(tokens[index]==='-') { index++; return unary().map(v=>-v); }
    return power();
  };
  const product = () => {
    let result=unary();
    while(tokens[index]==='*'||tokens[index]==='/'||tokens[index]==='x'||tokens[index]==='(') {
      const operator=tokens[index];
      if(operator==='*'||operator==='/')index++;
      const right=unary();
      if(operator==='/') {
        if(right[1]!==0||right[2]!==0||right[0]===0)throw new Error('Division requires a nonzero constant');
        result=bounded(result.map(v=>v/right[0]));
      } else result=multiply(result,right);
    }
    return result;
  };
  const expression = () => {
    let result=product();
    while(tokens[index]==='+'||tokens[index]==='-') { const sign=tokens[index++]==='+'?1:-1; result=add(result,product(),sign); }
    return result;
  };
  const result=expression();
  if(index!==tokens.length || result[2]===0)throw new Error('A complete quadratic expression is required');
  return {a:result[2],b:result[1],c:result[0]};
}
export function formatPlotTick(value, step) {
  if(!Number.isFinite(value)||!Number.isFinite(step)||step<=0)throw new Error('Invalid tick');
  if(Math.abs(value)<step*1e-9)return '0';
  const decimals=Math.max(0,Math.min(17,-Math.floor(Math.log10(step))+1));
  if(Math.abs(value)>=1e7 || Math.abs(value)<1e-6) return Number(value.toPrecision(Math.min(17,Math.max(6,Math.floor(Math.log10(Math.abs(value)))-Math.floor(Math.log10(step))+2)))).toExponential().replace(/e\+/, 'e');
  return Number(value.toFixed(decimals)).toLocaleString('en', {useGrouping:false,maximumFractionDigits:decimals});
}
export function isParabolaIntent(query) {
  return /(?:parabola|پرابولا|quadratic|y\s*=.*x)/i.test(query) && /(?:graph|plot|draw|bana|گراف)/i.test(query);
}
export function parabolaRequest(query) {
  query=String(query).replace(/[−–]/g,'-');
  if(!isParabolaIntent(query))return null;
  const assignment=/y\s*=\s*/i.exec(query);
  if(!assignment) {
    if(/[=^²]|\d/.test(query))return null;
    return {spec:{type:'quadratic',a:1,b:0,c:0,xMin:-5,xMax:5},assumption:true};
  }
  let body=query.slice(assignment.index+assignment[0].length).trim();
  const range=/\b(?:from|between)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:to|and)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/i.exec(body);
  if(range)body=body.slice(0,range.index).trim();
  // Remove only recognized request suffixes; never silently discard operators or math.
  body=body.replace(/\s+(?:please|ka\s+graph\s+banao|graph\s+banao|graph|plot|draw)[.!?]*$/i,'').replace(/[!?]+$/,'').trim();
  try {
    const {a,b,c}=parseQuadraticExpression(body); const vertex=-b/(2*a);
    const spec={type:'quadratic',a,b,c,xMin:range?Number(range[1]):vertex-5,xMax:range?Number(range[2]):vertex+5};
    quadraticData(spec); return {spec,assumption:false};
  } catch { return null; }
}
