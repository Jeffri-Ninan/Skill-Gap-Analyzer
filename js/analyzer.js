import {SKILLS,CATEGORIES} from "./skills-data.js";

export function analyze(extracted,profile) {
  const user=new Map(profile.map(item=>[item.skill,item]));
  const classified=extracted.map(item=>{
    const owned=user.get(item.skill);
    let status="gap",factor=0;
    if(owned) {
      if(owned.level>=3&&(!item.yearsRequired||owned.years>=item.yearsRequired)){status="match";factor=1;}
      else if(owned.level>=3&&item.yearsRequired&&owned.years<item.yearsRequired){status="partial";factor=.5;}
      else {status="partial";factor=.5;}
    }
    const relatedOwned=item.related.filter(skill=>user.has(skill));
    const priority=item.weight*(1+relatedOwned.length*.2)/item.learningHours;
    return {...item,status,factor,relatedOwned,priority};
  });
  const total=classified.reduce((sum,item)=>sum+item.weight,0);
  const score=total?Math.round(classified.reduce((sum,item)=>sum+item.weight*item.factor,0)/total*100):null;
  return {skills:classified,score,matched:classified.filter(item=>item.status==="match"),partial:classified.filter(item=>item.status==="partial"),gaps:classified.filter(item=>item.status==="gap").sort((a,b)=>b.priority-a.priority),totalWeight:total};
}
export function projectedScore(result,learned) {
  const total=result.skills.reduce((sum,item)=>sum+item.weight,0);
  return total?Math.round(result.skills.reduce((sum,item)=>sum+item.weight*(item.factor|| (learned.has(item.skill)?1:0)),0)/total*100):null;
}
export function radarValues(result,profile) {
  const totals=CATEGORIES.map(category=>result.skills.filter(item=>item.category===category).reduce((sum,item)=>sum+item.weight,0));
  const maxTotal=Math.max(1,...totals);
  return CATEGORIES.map(category=>{
    const items=result.skills.filter(item=>item.category===category);
    const total=items.reduce((sum,item)=>sum+item.weight,0);
    const required=total/maxTotal*5;
    const owned=items.filter(item=>item.status==="match").map(item=>profile.find(skill=>skill.skill===item.skill)).filter(Boolean);
    const level=owned.length?owned.reduce((sum,item)=>sum+item.level,0)/owned.length:0;
    return {category,required:Math.min(5,required),level,total};
  }).filter(item=>item.total>0||item.level>0);
}
export function frequencyAcrossAnalyses(analyses) {
  const counts=new Map();
  for(const analysis of analyses)for(const skill of analysis.gaps??[])counts.set(skill.skill,(counts.get(skill.skill)??0)+1);
  return [...counts].map(([skill,count])=>({skill,count,category:SKILLS[skill]?.category??"Other"})).sort((a,b)=>b.count-a.count||a.skill.localeCompare(b.skill));
}
