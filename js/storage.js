import {apiRequest} from "./api.js";

export async function loadState() {
  const result=await apiRequest("/data");
  const data = (result && typeof result === "object" && result.data) ? result.data : {};
  return {
    profile: data.profile ?? [],
    analyses: data.analyses ?? [],
    plan: data.plan ?? [],
    settings: data.settings ?? {theme: "dark"},
    draft: data.draft ?? null
  };
}

export async function saveState(state) {
  const payload = {
    profile: state.profile ?? [],
    analyses: state.analyses ?? [],
    plan: state.plan ?? [],
    settings: state.settings ?? {theme: "dark"},
    draft: state.draft ?? null
  };
  await apiRequest("/data",{method:"PUT",body:JSON.stringify({data:payload})});
  return structuredClone(state);
}

export function exportState(state) {
  const blob=new Blob([JSON.stringify({version:1,data:state},null,2)],{type:"application/json"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="skill-gap-analyzer-data.json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),0);
}

export function parseImport(text) {
  let parsed;
  try { parsed=JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  const data=parsed?.version===1?parsed.data:parsed;
  if(!data||!Array.isArray(data.profile)||!Array.isArray(data.analyses)||!Array.isArray(data.plan)||!data.settings||!["dark","light"].includes(data.settings.theme)) {
    throw new Error("The file does not match the expected profile, analyses, plan, and settings format.");
  }
  for(const skill of data.profile) {
    if(!skill||typeof skill.skill!=="string"||!Number.isInteger(skill.level)||skill.level<1||skill.level>5||!Number.isFinite(skill.years)||skill.years<0||skill.years>60)throw new Error("The file contains an invalid profile skill.");
  }
  const ids=new Set();
  for(const analysis of data.analyses) {
    if(!analysis||typeof analysis.id!=="string"||ids.has(analysis.id)||typeof analysis.date!=="string"||typeof analysis.jobTitle!=="string"||typeof analysis.company!=="string"||!(analysis.score===null||(Number.isInteger(analysis.score)&&analysis.score>=0&&analysis.score<=100))||!Array.isArray(analysis.matched)||!Array.isArray(analysis.partial)||!Array.isArray(analysis.gaps)||typeof analysis.jdText!=="string"||analysis.jdText.length>50000||!Array.isArray(analysis.extracted))throw new Error("The file contains an invalid analysis.");
    ids.add(analysis.id);
  }
  for(const item of data.plan) {
    if(!item||typeof item.skill!=="string"||typeof item.done!=="boolean"||!(item.targetDate===undefined||item.targetDate===null||item.targetDate===""||typeof item.targetDate==="string"))throw new Error("The file contains an invalid learning-plan item.");
  }
  if(new Set(data.profile.map(item=>item.skill.toLowerCase())).size!==data.profile.length||new Set(data.plan.map(item=>item.skill.toLowerCase())).size!==data.plan.length)throw new Error("The file contains duplicate profile or plan skills.");
  return structuredClone(data);
}

export function clearState() {
  return apiRequest("/data",{method:"DELETE"});
}

export function getLegacyState() {
  try {
    const raw=localStorage.getItem("skill-gap-analyzer:v1");
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    return parsed?.version===1?parseImport(JSON.stringify(parsed.data)):null;
  } catch(error) {
    console.warn("Unable to read the previous local profile for optional import.",error);
    return null;
  }
}
