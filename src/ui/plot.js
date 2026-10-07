// Safe mathematical plotting inside the app, not executable AI-generated code.
export function quadraticData(spec) {
  if (!spec || spec.type !== 'quadratic') throw new Error('Only quadratic plots are supported');
  const a = Number(spec.a ?? 1), b = Number(spec.b ?? 0), c = Number(spec.c ?? 0);
  const xMin = Number(spec.xMin ?? -5), xMax = Number(spec.xMax ?? 5);
  if (![a,b,c,xMin,xMax].every(Number.isFinite) || a === 0 || Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) > 1e6 || xMin >= xMax || Math.max(Math.abs(xMin),Math.abs(xMax)) > 1e4) throw new Error('Invalid quadratic coefficients/range');
  const evaluate = (x) => a*x*x+b*x+c;
  const points = Array.from({ length: 201 }, (_, i) => { const x = xMin + (xMax-xMin)*i/200; return { x, y: evaluate(x) }; });
  const vertexX = -b/(2*a), vertexY = evaluate(vertexX);
  const ys = points.map((point) => point.y);
  if (vertexX >= xMin && vertexX <= xMax) ys.push(vertexY);
  const low = Math.min(0,...ys), high = Math.max(0,...ys);
  const padding = Math.max((high-low)*0.12, 1);
  const rawStep = (high-low+2*padding)/4;
  const magnitude = 10**Math.floor(Math.log10(rawStep));
  let yStep = [1,2,5,10].map((factor)=>factor*magnitude).find((step)=>step>=rawStep);
  let yMin=Math.floor((low-padding)/yStep)*yStep, yMax=Math.ceil((high+padding)/yStep)*yStep;
  if(Math.round((yMax-yMin)/yStep)+1>6){yStep*=2;yMin=Math.floor((low-padding)/yStep)*yStep;yMax=Math.ceil((high+padding)/yStep)*yStep;}
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
      svg.appendChild(plotNode('text',{x:xMap(x),y:bottom+24,'text-anchor':'middle',class:'plot-tick'},Number(x.toPrecision(3)).toLocaleString("en",{notation:"compact",maximumFractionDigits:1})));
    }
    const yTicks=Math.round((data.yMax-data.yMin)/data.yStep);
    for(let i=0;i<=yTicks;i++) {
      const y=data.yMin+i*data.yStep;
      svg.appendChild(plotNode('line',{x1:left,y1:yMap(y),x2:right,y2:yMap(y),class:'plot-grid'}));
      svg.appendChild(plotNode('text',{x:left-8,y:yMap(y)+5,'text-anchor':'end',class:'plot-tick'},Number(y.toPrecision(3)).toLocaleString("en",{notation:"compact",maximumFractionDigits:1})));
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

export function parabolaRequest(query) {
  query = String(query).replace(/[−–]/g, '-');
  if (!/(?:parabola|پرابولا|quadratic|y\s*=.*x(?:\^2|²))/i.test(query) || !/(?:graph|plot|draw|bana|گراف)/i.test(query)) return null;
  const formula = query.match(/y\s*=\s*([+\-\d.\sx*^²]+)/i);
  if (!formula) {
    // Do not invent coefficients when the request mentions an unparsed equation.
    if (/[=^²]|\d/.test(query)) return null;
    return { spec: { type:'quadratic', a:1, b:0, c:0, xMin:-5, xMax:5 }, assumption:true };
  }
  const remaining = query.slice(formula.index + formula[0].length);
  if (remaining && !/\s$/.test(formula[1]) && !/^[?!.]/.test(remaining)) return null;
  const requestedRange = query.match(/(?:from|between)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:to|and)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/i);
  if (/\brange\b|\bfrom\b|\bbetween\b|xMin|xMax/i.test(query) && !requestedRange) return null;
  let expression=formula[1].replace(/\s|\*/g,'').replace(/²/g,'^2').toLowerCase();
  let a=0,b=0,c=0, first=true;
  while(expression) {
    const term=/^([+-]?)(?:(\d+(?:\.\d*)?|\.\d+))?(x(?:\^2)?)?/.exec(expression);
    if(!term || !term[0] || (!term[2] && !term[3]) || (!first && !term[1]))return null;
    const coefficient=(term[1]==='-'?-1:1)*Number(term[2] || 1);
    if(term[3]==='x^2')a+=coefficient;else if(term[3]==='x')b+=coefficient;else c+=coefficient;
    expression=expression.slice(term[0].length);first=false;
  }
  try {
    const vertex=-b/(2*a);
    const spec={type:'quadratic',a,b,c,xMin:requestedRange?Number(requestedRange[1]):vertex-5,xMax:requestedRange?Number(requestedRange[2]):vertex+5};
    quadraticData(spec);return {spec,assumption:false};
  } catch {return null;}
}
