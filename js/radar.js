const NS="http://www.w3.org/2000/svg";
function node(name,attrs={}) {const el=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
function point(cx,cy,r,index,count){const angle=-Math.PI/2+index*2*Math.PI/count;return [cx+r*Math.cos(angle),cy+r*Math.sin(angle)];}
export function renderRing(score) {
  const svg=node("svg",{viewBox:"0 0 220 220",class:"ring-svg",role:"img","aria-label":`Readiness score ${score} percent`});
  const circle=node("circle",{cx:110,cy:110,r:83,fill:"none",stroke:"var(--surface-2)","stroke-width":13});
  const circumference=2*Math.PI*83;
  const progress=node("circle",{cx:110,cy:110,r:83,fill:"none",stroke:"var(--accent)","stroke-width":13,"stroke-linecap":"round","stroke-dasharray":String(circumference),"stroke-dashoffset":String(circumference),transform:"rotate(-90 110 110)",class:"ring-progress"});
  requestAnimationFrame(()=>progress.setAttribute("stroke-dashoffset",String(circumference*(1-score/100))));
  const label=node("text",{x:110,y:108,"text-anchor":"middle",fill:"var(--text)","font-size":48,"font-weight":800});label.textContent=`${score}%`;
  const sub=node("text",{x:110,y:133,"text-anchor":"middle",fill:"var(--muted)","font-size":12});sub.textContent="readiness";
  svg.append(circle,progress,label,sub);return svg;
}
export function renderRadar(values) {
  const svg=node("svg",{viewBox:"0 0 440 360",role:"img","aria-label":"Radar chart comparing required skills with your skill levels"});
  const cx=220,cy=175,radius=125,count=Math.max(values.length,3);
  for(let ring=1;ring<=5;ring++) {
    const points=Array.from({length:count},(_,i)=>point(cx,cy,radius*ring/5,i,count).join(",")).join(" ");
    svg.append(node("polygon",{points,fill:"none",stroke:"var(--line)","stroke-width":1}));
  }
  const required=[],yours=[];
  values.forEach((value,index)=>{
    const axis=point(cx,cy,radius,index,count);svg.append(node("line",{x1:cx,y1:cy,x2:axis[0],y2:axis[1],stroke:"var(--line)"}));
    const labelPoint=point(cx,cy,radius+26,index,count),label=node("text",{x:labelPoint[0],y:labelPoint[1],"text-anchor":labelPoint[0]<cx-10?"end":labelPoint[0]>cx+10?"start":"middle",fill:"var(--muted)","font-size":11});
    label.textContent=value.category;svg.append(label);
    required.push(point(cx,cy,radius*value.required/5,index,count).join(","));
    yours.push(point(cx,cy,radius*value.level/5,index,count).join(","));
  });
  const center=Array.from({length:count},()=>`${cx},${cy}`).join(" ");
  const requiredPolygon=node("polygon",{points:center,fill:"#c4f36b33",stroke:"var(--accent)","stroke-width":2,class:"radar-polygon"});
  const yoursPolygon=node("polygon",{points:center,fill:"#74c9e933",stroke:"#74c9e9","stroke-width":2,class:"radar-polygon"});
  svg.append(requiredPolygon,yoursPolygon);
  requestAnimationFrame(()=>{requiredPolygon.setAttribute("points",required.join(" "));yoursPolygon.setAttribute("points",yours.join(" "));});
  return svg;
}
export function renderTrend(analyses) {
  const svg=node("svg",{viewBox:"0 0 640 240",role:"img","aria-label":"Readiness score trend for selected job title"});
  const data=[...analyses].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(!data.length)return svg;
  const x=i=>45+(data.length===1?0:i/(data.length-1)*550);
  const coords=data.map((item,i)=>[x(i),190-item.score*1.55]);
  svg.append(node("line",{x1:40,y1:190,x2:600,y2:190,stroke:"var(--line)"}),node("line",{x1:40,y1:30,x2:40,y2:190,stroke:"var(--line)"}));
  svg.append(node("polyline",{points:coords.map(p=>p.join(",")).join(" "),fill:"none",stroke:"var(--accent)","stroke-width":3}));
  coords.forEach(([px,py],index)=>{svg.append(node("circle",{cx:px,cy:py,r:5,fill:"var(--accent)"}));const label=node("text",{x:px,y:py-11,"text-anchor":"middle",fill:"var(--text)","font-size":11});label.textContent=`${data[index].score}%`;svg.append(label);});
  return svg;
}
