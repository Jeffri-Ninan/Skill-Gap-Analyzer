const STORAGE_KEY = "skill-gap-analyzer:v1";
const preferredTheme = typeof window!=="undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
const DEFAULT_STATE = {profile:[],analyses:[],plan:[],settings:{theme:preferredTheme}};
let memoryState = structuredClone(DEFAULT_STATE);

function validState(value) {
  if(!value||typeof value!=="object"||!Array.isArray(value.profile)||!Array.isArray(value.analyses)||!Array.isArray(value.plan)||!value.settings||!["dark","light"].includes(value.settings.theme))return false;
  if(!value.profile.every(item=>item&&typeof item.skill==="string"&&Number.isInteger(item.level)&&item.level>=1&&item.level<=5&&Number.isFinite(item.years)&&item.years>=0&&item.years<=60))return false;
  if(!value.analyses.every(item=>item&&typeof item.id==="string"&&typeof item.date==="string"&&typeof item.jobTitle==="string"&&typeof item.company==="string"&&(item.score===null||(Number.isFinite(item.score)&&item.score>=0&&item.score<=100))&&Array.isArray(item.matched)&&item.matched.every(skill=>typeof skill==="string")&&Array.isArray(item.partial)&&item.partial.every(skill=>typeof skill==="string")&&Array.isArray(item.gaps)&&item.gaps.every(gap=>gap&&typeof gap.skill==="string")&&typeof item.jdText==="string"&&Array.isArray(item.extracted)&&item.extracted.every(skill=>skill&&typeof skill.skill==="string"&&typeof skill.category==="string"&&Number.isFinite(skill.mentions)&&Number.isFinite(skill.weight)&&Number.isFinite(skill.learningHours)&&Number.isFinite(skill.yearsRequired)&&Array.isArray(skill.related)&&skill.related.every(value=>typeof value==="string")&&Array.isArray(skill.resources)&&skill.resources.every(value=>typeof value==="string"))&&(item.profileSnapshot===undefined||(Array.isArray(item.profileSnapshot)&&item.profileSnapshot.every(skill=>skill&&typeof skill.skill==="string"&&Number.isInteger(skill.level)&&skill.level>=1&&skill.level<=5&&Number.isFinite(skill.years)&&skill.years>=0&&skill.years<=60)))))return false;
  return value.plan.every(item=>item&&typeof item.skill==="string"&&typeof item.done==="boolean"&&(item.targetDate===""||typeof item.targetDate==="string"));
}
function normalize(value) {
  return {profile:value.profile,analyses:value.analyses,plan:value.plan,settings:{...DEFAULT_STATE.settings,...value.settings}};
}
export function loadState() {
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw===null)return structuredClone(DEFAULT_STATE);
    const parsed=JSON.parse(raw);
    if(parsed.version!==1 || !validState(parsed.data))throw new Error("Saved data has an unsupported format.");
    memoryState=normalize(parsed.data);
    return structuredClone(memoryState);
  } catch(error) {
    console.warn("Unable to read saved Skill Gap Analyzer data; using in-memory storage.",error);
    return structuredClone(memoryState);
  }
}
export function saveState(state) {
  if(!validState(state))throw new TypeError("Cannot save invalid Skill Gap Analyzer data.");
  memoryState=normalize(state);
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,data:memoryState})); }
  catch(error) { console.warn("Persistent storage is unavailable; changes are kept in memory for this session.",error); }
  return structuredClone(memoryState);
}
export function exportState(state) {
  const blob=new Blob([JSON.stringify({version:1,data:normalize(state)},null,2)],{type:"application/json"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="skill-gap-analyzer-data.json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),0);
}
export function parseImport(text) {
  let parsed;
  try { parsed=JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  const data=parsed?.version===1?parsed.data:parsed;
  if(!validState(data))throw new Error("The file does not match the expected profile, analyses, plan, and settings format.");
  const normalized=normalize(data);
  if(!validState(normalized))throw new Error("The file contains invalid profile, analysis, plan, or settings data.");
  return normalized;
}
export function clearState() {
  memoryState=structuredClone(DEFAULT_STATE);
  try { localStorage.removeItem(STORAGE_KEY); } catch(error) { console.warn("Unable to clear browser storage; data is cleared for this session.",error); }
}
