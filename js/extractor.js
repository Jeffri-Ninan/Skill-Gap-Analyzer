import {SKILLS} from "./skills-data.js";

const OPTIONAL=/\b(preferred|nice to have|nice-to-have|bonus|a plus|plus|desirable)\b/i;
const REQUIRED=/\b(requirements?|must have|qualifications?|responsibilities|what you.ll do|minimum qualifications?)\b/i;
const AMBIGUOUS=new Set(["go","r","swift","spring","rust"]);
const TECH_CONTEXT=/\b(golang|programming language|backend|services|framework|api|systems programming|go development)\b/i;
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const normalizedText=text=>text.toLowerCase().replace(/\s+/g," ").trim();
function skillPattern(skill) {
  const words=escapeRegex(skill).replace(/\s+/g,"\\s+");
  return new RegExp(`(^|[^a-z0-9])(${words})(?=$|[^a-z0-9])`,"gi");
}
function ambiguousAllowed(skill,original,matchIndex) {
  if(!AMBIGUOUS.has(skill))return true;
  const token=original.slice(matchIndex,matchIndex+skill.length);
  if(/^[A-Z]/.test(token))return true;
  const delimiters=["\n",".","!","?",";"];
  const left=Math.max(-1,...delimiters.map(delimiter=>original.lastIndexOf(delimiter,matchIndex-1)));
  const rightPositions=delimiters.map(delimiter=>{const position=original.indexOf(delimiter,matchIndex+skill.length);return position<0?original.length:position;});
  const context=normalizedText(original.slice(left+1,Math.min(...rightPositions)));
  return TECH_CONTEXT.test(context) || (skill==="spring"&&/\b(java|boot|framework)\b/i.test(context)) || (skill==="rust"&&/\b(cargo|systems)\b/i.test(context));
}
function collectSections(text) {
  const lines=text.split(/\n/);let mode="required";
  const sections=[];
  for(const line of lines) {
    const heading=line.trim().replace(/^[•*\-#\s]+/,"");
    if(OPTIONAL.test(heading))mode="optional";
    else if(REQUIRED.test(heading))mode="required";
    sections.push({line,mode});
  }
  return sections;
}
export function extractSkills(text,jobTitle="") {
  const title=normalizedText(jobTitle);
  const sections=collectSections(text);
  const found={};
  for(const [skill,definition] of Object.entries(SKILLS)) {
    const variants=[skill,...definition.aliases];
    let mentions=0,inRequiredSection=false,inOptionalSection=false,inTitle=false,yearsRequired=0;
    for(const variant of variants) {
      const re=skillPattern(variant);let match;
      while((match=re.exec(text))!==null) {
        const index=match.index+match[1].length;
        if(!ambiguousAllowed(skill,text,index))continue;
        mentions++;
        const lineStart=text.lastIndexOf("\n",index)+1;
        const lineIndex=text.slice(0,lineStart).split("\n").length-1;
        const section=sections[lineIndex]?.mode??"required";
        if(section==="required")inRequiredSection=true;else inOptionalSection=true;
        if(title && skillPattern(variant).test(title))inTitle=true;
        const before=text.slice(Math.max(0,index-48),index);
        const years=before.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:(?:hands-on|professional)\s+)?$/i);
        if(years)yearsRequired=Math.max(yearsRequired,Number(years[1]));
      }
    }
    if(mentions) {
      if(/\b(mern)\b/i.test(text)&&["mongodb","express","react","node.js"].includes(skill))mentions++;
      let weight=mentions+(inRequiredSection?3:0)+(inTitle?2:0);
      if(inOptionalSection&&!inRequiredSection)weight*=0.5;
      found[skill]={skill,category:definition.category,mentions,inRequiredSection,inOptionalSection,inTitle,yearsRequired,weight,learningHours:definition.learningHours,related:definition.related,resources:definition.resources};
    }
  }
  return {skills:Object.values(found).sort((a,b)=>b.weight-a.weight),hasSkills:Object.keys(found).length>0};
}
