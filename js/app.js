import {initializeRouter} from "./router.js";
import {SKILLS,ROLE_TEMPLATES,SAMPLE_JDS} from "./skills-data.js";
import {loadState,saveState,exportState,parseImport,clearState,getLegacyState} from "./storage.js";
import {apiRequest} from "./api.js";
import {extractSkills} from "./extractor.js";
import {analyze,projectedScore,radarValues,frequencyAcrossAnalyses} from "./analyzer.js";
import {renderRing,renderRadar,renderTrend} from "./radar.js";

const app=document.querySelector("#app");
let state={profile:[],analyses:[],plan:[],settings:{theme:"dark"}},currentUser=null,currentRoute="",currentAnalysisId=null,whatIf=new Set(),suggestionIndex=-1,authMode="login",legacyState=null;
const $=(selector,root=document)=>root.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const pretty=value=>value.replace(/\b\w/g,char=>char.toUpperCase());
const notify=message=>{const region=$("#toast-region"),toast=document.createElement("div");toast.className="toast";toast.textContent=message;region.append(toast);setTimeout(()=>toast.remove(),3200);};
async function persist(message) {
  try {
    state=await saveState(state);
    applyTheme();
    if(message)notify(message);
    return true;
  } catch(error) {
    console.error("Save state error:", error);
    notify(error instanceof Error?error.message:"Your changes could not be saved to the database.");
    return false;
  }
}

function renderAuth(message="") {
  currentRoute="auth";currentUser=null;state={profile:[],analyses:[],plan:[],settings:{theme:"dark"}};showAccount();applyTheme();
  app.innerHTML=`<section class="auth-layout"><div class="auth-intro"><div class="eyebrow">Your career, with a plan</div><h1>Understand your fit.<br><span class="brand-accent">Build what’s next.</span></h1><p class="lede">Compare your skills with real job descriptions and focus your learning on the gaps that matter.</p><div class="auth-points"><p>✓ Private profile, saved to your account</p><p>✓ Readiness insights and prioritized learning</p><p>✓ Sign in securely with email or GitHub</p></div></div><section class="card auth-card"><div class="eyebrow">Skill Gap Analyzer</div><h2>${authMode==="login"?"Welcome back":"Create your account"}</h2><p class="muted">${authMode==="login"?"Sign in to access your private profile and analyses.":"Your data is private to your account."}</p><form id="auth-form"><div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" required></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${authMode==="login"?"current-password":"new-password"}" minlength="8" maxlength="128" required><span class="hint">${authMode==="register"?"Use at least 8 characters.":""}</span></div><div class="error" id="auth-error" role="alert">${esc(message)}</div><button class="button primary auth-submit" type="submit">${authMode==="login"?"Sign in":"Create account"}</button></form><div class="auth-divider"><span>or</span></div><a class="button github-button" href="/api/auth/github">Continue with GitHub</a><p class="auth-switch">${authMode==="login"?"New to Skill Gap Analyzer?":"Already have an account?"} <button type="button" class="text-button" data-auth-mode="${authMode==="login"?"register":"login"}">${authMode==="login"?"Create an account":"Sign in"}</button></p><p class="hint">By continuing, your profile and job analyses will be saved privately to your account.</p></section></section>`;
  app.focus({preventScroll:true});
  apiRequest("/auth/github/status").then(result=>{const link=$(".github-button");if(link)link.hidden=!result.enabled;}).catch(()=>{const link=$(".github-button");if(link)link.hidden=true;});
}
const selectedAnalysis=()=>state.analyses.find(item=>item.id===currentAnalysisId)??state.analyses[state.analyses.length-1]??null;
const daysFromNow=days=>{const date=new Date();date.setDate(date.getDate()+days);return date.toISOString().slice(0,10);};
const applyTheme=()=>{document.documentElement.dataset.theme=state.settings.theme;$("#theme-toggle").textContent=state.settings.theme==="dark"?"☼":"☾";$("#theme-toggle").setAttribute("aria-label",`Switch to ${state.settings.theme==="dark"?"light":"dark"} theme`);};
const showAccount=()=>{document.querySelector(".main-nav").hidden=!currentUser;$("#account-controls").hidden=!currentUser;$("#theme-toggle").hidden=!currentUser;$("#account-email").textContent=currentUser?.email??"";};

function pageHead(eyebrow,title,description,actions="") {
  return `<div class="page-heading"><div class="heading-copy"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="lede">${description}</p></div>${actions?`<div class="button-row">${actions}</div>`:""}</div>`;
}
function emptyState(title,copy,href,label) {
  return `<div class="empty"><strong>${title}</strong><p>${copy}</p>${href?`<a class="button primary" href="${href}">${label}</a>`:""}</div>`;
}
function renderProfile() {
  const rows=state.profile.length?state.profile.map(item=>`<div class="skill-row" data-skill="${esc(item.skill)}"><strong>${esc(pretty(item.skill))}<span class="muted"> · ${esc(SKILLS[item.skill]?.category??"Other")}</span></strong><label class="hint">Level <select aria-label="${esc(item.skill)} proficiency level" data-profile-level="${esc(item.skill)}">${[1,2,3,4,5].map(level=>`<option value="${level}"${level===item.level?" selected":""}>${level} / 5</option>`).join("")}</select></label><label class="hint">Years <input aria-label="${esc(item.skill)} years of experience" type="number" min="0" max="60" step=".5" value="${item.years}" data-profile-years="${esc(item.skill)}"></label><button class="button small danger" type="button" data-remove-skill="${esc(item.skill)}" aria-label="Remove ${esc(item.skill)}">Remove</button></div>`).join(""):emptyState("Your profile is ready to grow","Add skills below or choose a role template to start with realistic sample experience.","#/analyze","Continue to analysis");
  const templateCards=Object.entries(ROLE_TEMPLATES).map(([title,items])=>`<button class="card template-card" type="button" data-template="${esc(title)}"><span class="eyebrow">Role template</span><h3>${esc(title)}</h3><p>${items.length} starter skills · click to load this sample profile</p></button>`).join("");
  const hasAccountData=state.profile.length||state.analyses.length||state.plan.length;
  const migration=legacyState&&!hasAccountData?`<section class="card migration-card"><h2>Import your previous browser data?</h2><p class="muted">We found a profile saved by the earlier version of this app on this device. It will only be copied into your account if you choose to import it.</p><button class="button" data-action="migrate-legacy">Import previous data</button></section>`:"";
  return `${pageHead("Your foundation","Build your skill profile","Add the skills you use, then compare your experience against a role. Your profile is saved privately to your account.","<button class=\"button\" data-action=\"export\">Export JSON</button> <button class=\"button\" data-action=\"import\">Import JSON</button>")}
  ${migration}
  <section class="card"><h2>Add a skill</h2><p class="muted">Search our skill dictionary. Duplicate skills are prevented.</p>
    <form id="add-skill-form" class="inline-form" autocomplete="off">
      <div class="field autocomplete"><label for="skill-entry">Skill</label><input id="skill-entry" name="skill" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="skill-suggestions" placeholder="Try React, SQL, or communication" required><div class="suggestions" id="skill-suggestions" role="listbox" hidden></div></div>
      <div class="field"><label for="skill-level">Level</label><select id="skill-level" name="level"><option value="1">1 · Learning</option><option value="2">2 · Beginner</option><option value="3" selected>3 · Working</option><option value="4">4 · Advanced</option><option value="5">5 · Expert</option></select></div>
      <div class="field"><label for="skill-years">Years</label><input id="skill-years" name="years" type="number" min="0" max="60" step=".5" value="1"></div>
      <button class="button primary" type="submit">Add skill</button>
    </form></section>
    <section class="section-gap"><div class="page-heading"><div><h2>Current skills <span class="pill">${state.profile.length}</span></h2><p class="muted">Update your proficiency or experience at any time.</p></div></div><div class="skill-list">${rows}</div></section>
    <section class="section-gap"><h2>Start with a role template</h2><p class="muted">Templates replace your current profile after confirmation.</p><div class="grid grid-3">${templateCards}</div></section>
    <section class="card section-gap"><h2>Import skills from a resume</h2><p class="muted">Paste resume text to propose recognized skills at level 3. Review and add them to your profile.</p><div class="field"><label for="resume-text">Resume text</label><textarea id="resume-text" placeholder="Paste relevant experience, projects, and skills here"></textarea></div><button class="button" data-action="parse-resume">Find profile suggestions</button><div id="resume-suggestions" class="button-row section-gap" aria-live="polite"></div></section>
    <div class="button-row section-gap"><button class="button danger" data-action="reset">Reset all data</button></div>`;
}
function renderAnalyze() {
  const title=state.draft?.jobTitle??"",company=state.draft?.company??"",text=state.draft?.jdText??"";
  return `${pageHead("Role fit","Analyze a job description","Paste the role details to see where your current skills line up. For best results, include both required and preferred qualifications.","<a class=\"button\" href=\"#/profile\">Edit profile</a>")}
    ${state.profile.length?`<section class="card"><div class="grid grid-2"><div class="field"><label for="job-title">Job title <span class="muted">(optional)</span></label><input id="job-title" value="${esc(title)}" placeholder="e.g. Senior Frontend Developer"></div><div class="field"><label for="company">Company <span class="muted">(optional)</span></label><input id="company" value="${esc(company)}" placeholder="e.g. Northstar Labs"></div></div><div class="field"><label for="jd-text">Job description</label><textarea id="jd-text" maxlength="50000" placeholder="Paste the job description here…">${esc(text)}</textarea><div class="hint" id="jd-count">${text.length.toLocaleString()} / 50,000 characters</div><div id="analysis-error" class="error" role="alert"></div></div><div class="button-row">${SAMPLE_JDS.map((sample,index)=>`<button class="button small" data-sample="${index}" type="button">Load ${esc(sample.title)} sample</button>`).join("")}<button class="button primary" data-action="analyze" type="button">Analyze role <span aria-hidden="true">→</span></button></div></section><p class="notice section-gap">Results are estimates based on keyword matching. Review the extracted skills and role context before making career decisions.</p>`:emptyState("Add your skills first","A meaningful readiness score needs a profile to compare with the job description.","#/profile","Build your profile")}`;
}
function getAnalysisResult(record) {return analyze(record.extracted??[],record.profileSnapshot??state.profile);}
function highlightedJD(record,result) {
  const spans=[];
  for(const item of result.skills) {
    const definition=SKILLS[item.skill];if(!definition)continue;
    for(const term of [item.skill,...definition.aliases]) {
      const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
      const re=new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9])`,"gi");let match;
      while((match=re.exec(record.jdText))!==null){const start=match.index+match[1].length;spans.push({start,end:start+match[2].length,status:item.status});}
    }
  }
  spans.sort((a,b)=>a.start-b.start||b.end-a.end);
  const accepted=[];for(const span of spans){if(!accepted.length||span.start>=accepted[accepted.length-1].end)accepted.push(span);}
  let cursor=0,html="";
  for(const span of accepted){html+=esc(record.jdText.slice(cursor,span.start))+`<mark class="${span.status}">${esc(record.jdText.slice(span.start,span.end))}</mark>`;cursor=span.end;}
  return html+esc(record.jdText.slice(cursor));
}
function renderResults() {
  const record=selectedAnalysis();
  if(!record)return `${pageHead("Your results","No analysis yet","Analyze a job description to see your readiness and a prioritized skill plan.")}${emptyState("Ready when you are","Start with a role description and your profile.","#/analyze","Analyze a role")}`;
  const result=getAnalysisResult(record);
  if(result.score===null)return `${pageHead("Your results","No recognizable skills found","We couldn't identify supported skills in this job description. Try adding a requirements section or more technical detail.","<a class=\"button\" href=\"#/analyze\">Edit job description</a>")}<div class="card">${emptyState("No score for this description","No score is shown when no dictionary skills are detected, so an empty result is not mistaken for 0% readiness.","#/analyze","Try another description")}</div>`;
  const score=result.score,projected=projectedScore(result,whatIf);
  const group=(key,label,icon)=>`<section class="card skill-column"><h3>${label}<span class="pill">${result[key].length}</span></h3>${result[key].length?`<ul>${result[key].map(item=>`<li><span class="chip ${key==="matched"?"match":key==="partial"?"partial":"gap"}">${icon} ${esc(pretty(item.skill))}</span></li>`).join("")}</ul>`:`<p class="muted">Nothing to show here yet.</p>`}</section>`;
  const gapCards=result.gaps.length?result.gaps.map(item=>`<article class="card gap-card"><header><div><h3>${esc(pretty(item.skill))}</h3><span class="pill">${esc(item.category)}</span> <span class="muted">${item.weight.toFixed(1)} weight · ${item.learningHours}h estimated</span></div><button class="button small" data-add-plan="${esc(item.skill)}">${state.plan.some(plan=>plan.skill===item.skill)?"In plan":"Add to plan"}</button></header><p>${item.relatedOwned.length?`Related skills you have: ${item.relatedOwned.map(esc).join(", ")}`:"Build foundational knowledge before tackling this skill."}</p><ul>${item.resources.map(resource=>`<li>${esc(resource)}</li>`).join("")}</ul></article>`).join(""):`<div class="card">${emptyState("No missing skills","You match every detected skill at the requested proficiency and experience level.")}</div>`;
  const chartValues=radarValues(result,record.profileSnapshot??state.profile),table=`<table class="chart-table"><caption>Required skill weight and your average level by category</caption><thead><tr><th>Category</th><th>Required (0–5)</th><th>Your level (0–5)</th></tr></thead><tbody>${chartValues.map(value=>`<tr><td>${esc(value.category)}</td><td>${value.required.toFixed(1)}</td><td>${value.level.toFixed(1)}</td></tr>`).join("")}</tbody></table>`;
  return `${pageHead("Your results",esc(record.jobTitle||"Role readiness"),`${esc(record.company||"Job description analysis")} · ${new Date(record.date).toLocaleDateString()}`,"<a class=\"button\" href=\"#/analyze\">Analyze another role</a>")}
    <div class="score-layout card"><div id="score-ring"></div><div><div class="eyebrow">Your role readiness</div><div id="score-live" aria-live="polite"><p class="metric">${score}%</p></div><p class="muted">${result.matched.length} matched · ${result.partial.length} partial · ${result.gaps.length} gaps</p><p class="hint">Readiness is a weighted estimate—not a hiring prediction.</p></div></div>
    <div class="viz-grid section-gap"><section class="card radar-wrap"><h2>Skill profile</h2><div id="radar-chart"></div>${table}<div class="legend"><span><i></i>Required by role</span><span><i class="legend-you"></i>Your level</span></div></section>
    <section class="card"><h2>What if you learned these?</h2><p class="muted">Select the missing skills you plan to learn and see an estimated score change.</p>${result.gaps.length?`<div class="skill-list">${result.gaps.map(item=>`<label class="comparison-select"><input type="checkbox" data-whatif="${esc(item.skill)}"${whatIf.has(item.skill)?" checked":""}> ${esc(pretty(item.skill))}</label>`).join("")}</div>`:`<p class="muted">No gaps to project.</p>`}<p class="section-gap"><span class="muted">Projected score</span><br><strong class="score-change">${score}% → ${projected}%</strong></p></section></div>
    <section class="section-gap"><h2>Skills in the description</h2><div class="results-columns">${group("matched","Matched","✓")}${group("partial","Partial","~")}${group("gaps","Missing","✗")}</div></section>
    <section class="section-gap"><div><div class="eyebrow">Prioritized next steps</div><h2>Close your highest-impact gaps</h2><p class="muted">Priority rewards skills related to ones you already have, weighted by estimated learning time.</p></div>${gapCards}</section>
    <section class="card section-gap"><h2>Job description highlights</h2><div class="legend"><span>✓ Matched</span><span>~ Partial</span><span>✗ Gap</span></div><p class="highlight-text section-gap">${highlightedJD(record,result)}</p></section>
    <p class="notice section-gap">Results are estimates based on keyword matching.</p>`;
}
function renderPlan() {
  const rows=state.plan.map(item=>`<div class="plan-row ${item.done?"done":""}"><input type="checkbox" data-plan-done="${esc(item.skill)}" aria-label="Mark ${esc(item.skill)} ${item.done?"not done":"done"}"${item.done?" checked":""}><span class="plan-name"><strong>${esc(pretty(item.skill))}</strong><span class="muted"> · ${esc(SKILLS[item.skill]?.category??"Other")}</span></span><span class="muted">${SKILLS[item.skill]?.learningHours??"—"}h</span><input type="date" value="${esc(item.targetDate??"")}" data-plan-date="${esc(item.skill)}" aria-label="Target date for ${esc(item.skill)}"></div>`).join("");
  const done=state.plan.filter(item=>item.done).length,percent=state.plan.length?Math.round(done/state.plan.length*100):0;
  return `${pageHead("Make progress","Your learning plan","Turn the highest-priority gaps into manageable next steps. Add skills from your results and track your progress.")}<section class="card"><div class="page-heading"><div><h2>Plan progress</h2><p class="muted">${done} of ${state.plan.length} skills completed</p></div><strong class="score-change">${percent}%</strong></div><div class="progress-track" role="progressbar" aria-label="Learning plan progress" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>${state.plan.length?`<div class="section-gap">${rows}</div>`:emptyState("Your plan is empty","Analyze a job, then add a recommended gap to create your learning plan.","#/analyze","Analyze a role")}</section>`;
}
function renderHistory() {
  const analyses=state.analyses;
  const rows=analyses.length?[...analyses].reverse().map(item=>`<div class="history-row"><div><h3>${esc(item.jobTitle||"Untitled role")}</h3><span class="muted">${esc(item.company||"")}${item.company?" · ":""}${new Date(item.date).toLocaleDateString()}</span></div><span class="pill">${item.score===null?"No score":`${item.score}% ready`}</span><div class="history-actions"><button class="button small" data-open-analysis="${esc(item.id)}">Open</button><button class="button small danger" data-delete-analysis="${esc(item.id)}" aria-label="Delete ${esc(item.jobTitle||"analysis")}">Delete</button></div></div>`).join(""):emptyState("No saved analyses","Your role comparisons will appear here after you analyze a job description.","#/analyze","Analyze a role");
  return `${pageHead("Your progress","Analysis history","Revisit past roles, compare job descriptions, and see how readiness changes over time.","<button class=\"button\" data-action=\"export\">Export JSON</button>")}
    <section class="card"><h2>Past analyses <span class="pill">${analyses.length}</span></h2>${rows}</section>
    ${analyses.length?`<section class="card section-gap"><h2>Compare roles</h2><p class="muted">Select 2–5 past analyses to find the skills that appear most often across their gaps.</p><div class="comparison-select section-gap">${analyses.map(item=>`<label><input type="checkbox" data-compare="${esc(item.id)}"> ${esc(item.jobTitle||"Untitled role")} · ${new Date(item.date).toLocaleDateString()}</label>`).join("")}</div><button class="button primary section-gap" data-action="compare">Compare selected roles</button><p id="compare-error" class="error" role="alert"></p><div id="comparison-results"></div><div class="trend-wrap section-gap"><h2>Readiness trend by job title</h2><label class="field"><span>Choose a title</span><select id="trend-title">${[...new Set(analyses.map(item=>item.jobTitle||"Untitled role"))].map(title=>`<option>${esc(title)}</option>`).join("")}</select></label><div id="trend-chart"></div></div></section>`:""}`;
}
function render(route) {
  currentRoute=route;
  document.querySelectorAll(".main-nav a").forEach(link=>{if(link.dataset.route===route)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");});
  app.innerHTML=route==="profile"?renderProfile():route==="analyze"?renderAnalyze():route==="results"?renderResults():route==="plan"?renderPlan():renderHistory();
  app.focus({preventScroll:true});
  if(route==="results"){
    const record=selectedAnalysis();if(record){const result=getAnalysisResult(record);if(result.score!==null){$("#score-ring").append(renderRing(result.score));$("#radar-chart").append(renderRadar(radarValues(result,record.profileSnapshot??state.profile)));}}
  }
  if(route==="history"&&state.analyses.length)updateTrend();
}
function updateTrend() {
  const title=$("#trend-title")?.value;if(!title)return;
  const svg=renderTrend(state.analyses.filter(item=>(item.jobTitle||"Untitled role")===title));
  const container=$("#trend-chart");container.replaceChildren(svg);
}
async function addProfileSkill(skill,level=3,years=0) {
  if(!SKILLS[skill])return notify("Choose a skill from the suggestions.");
  if(state.profile.some(item=>item.skill===skill))return notify(`${pretty(skill)} is already in your profile.`);
  state.profile.push({skill,level:Number(level),years:Number(years)});
  state.profile.sort((a,b)=>a.skill.localeCompare(b.skill));
  if(await persist(`${pretty(skill)} added to your profile.`))render("profile");
}
function showSuggestions() {
  const input=$("#skill-entry"),list=$("#skill-suggestions");if(!input||!list)return;
  const query=input.value.trim().toLowerCase();
  const matches=Object.keys(SKILLS).filter(skill=>(skill.includes(query)||SKILLS[skill].aliases.some(alias=>alias.includes(query)))&&!state.profile.some(item=>item.skill===skill)).slice(0,8);
  list.innerHTML=matches.map((skill,index)=>`<button type="button" role="option" id="suggestion-${index}" aria-selected="${index===suggestionIndex}" data-suggest="${esc(skill)}">${esc(pretty(skill))} <span class="muted">· ${esc(SKILLS[skill].category)}</span></button>`).join("");
  list.hidden=!matches.length;input.setAttribute("aria-expanded",String(matches.length>0));
  if(suggestionIndex>=matches.length)suggestionIndex=-1;
}
async function analyzeDraft() {
  const error=$("#analysis-error"),text=$("#jd-text").value.trim(),title=$("#job-title").value.trim(),company=$("#company").value.trim();
  if(state.profile.length===0){error.textContent="Add at least one skill to your profile before analyzing a role.";return;}
  if(text.length<30){error.textContent="Add a little more detail (at least 30 characters), ideally including a requirements section.";return;}
  if(text.length>50000){error.textContent="This description is too long. Keep it under 50,000 characters.";return;}
  const extraction=extractSkills(text,title);
  if(!extraction.hasSkills){
    const record={id:crypto.randomUUID(),date:new Date().toISOString(),jobTitle:title,company,score:null,matched:[],partial:[],gaps:[],jdText:text,extracted:[],profileSnapshot:structuredClone(state.profile)};
    state.analyses.push(record);
    state.draft={jdText:text,jobTitle:title,company};
    currentAnalysisId=record.id;
    await persist();
    location.hash="#/results";
    render("results");
    return;
  }
  const computed=analyze(extraction.skills,state.profile);
  const record={id:crypto.randomUUID(),date:new Date().toISOString(),jobTitle:title,company,score:computed.score,matched:computed.matched.map(item=>item.skill),partial:computed.partial.map(item=>item.skill),gaps:computed.gaps.map(item=>({skill:item.skill,weight:item.weight})),jdText:text,extracted:extraction.skills,profileSnapshot:structuredClone(state.profile)};
  state.analyses.push(record);
  state.draft={jdText:text,jobTitle:title,company};
  whatIf.clear();
  currentAnalysisId=record.id;
  await persist("Analysis saved.");
  location.hash="#/results";
  render("results");
}
function loadSample(index) {
  const sample=SAMPLE_JDS[index];$("#job-title").value=sample.title;$("#company").value=sample.company;$("#jd-text").value=sample.text;
  state.draft={jdText:sample.text,jobTitle:sample.title,company:sample.company};$("#jd-count").textContent=`${sample.text.length} / 50,000 characters`;
}
function compareSelected() {
  const ids=[...document.querySelectorAll("[data-compare]:checked")].map(item=>item.dataset.compare);
  const error=$("#compare-error");error.textContent="";
  if(ids.length<2||ids.length>5){error.textContent="Select between 2 and 5 analyses to compare.";return;}
  const selected=state.analyses.filter(item=>ids.includes(item.id)),frequent=frequencyAcrossAnalyses(selected);
  $("#comparison-results").innerHTML=`<div class="section-gap"><h3>Most common gaps across ${selected.length} roles</h3>${frequent.length?`<ol>${frequent.map(item=>`<li>${esc(pretty(item.skill))} <span class="pill">${item.count} ${item.count===1?"role":"roles"}</span> <span class="muted">${esc(item.category)}</span></li>`).join("")}</ol>`:`<p class="muted">These roles have no saved skill gaps in common.</p>`}</div>`;
}
async function handleClick(event) {
  const target=event.target.closest("button");if(!target)return;
  if(target.dataset.authMode){authMode=target.dataset.authMode;renderAuth();$("#auth-email")?.focus();return;}
  if(target.dataset.suggest){$("#skill-entry").value=target.dataset.suggest;$("#skill-suggestions").hidden=true;$("#skill-entry").setAttribute("aria-expanded","false");suggestionIndex=-1;return;}
  if(target.dataset.removeSkill){state.profile=state.profile.filter(item=>item.skill!==target.dataset.removeSkill);if(await persist("Skill removed."))render("profile");return;}
  if(target.dataset.template){const title=target.dataset.template;if(state.profile.length&&!confirm("Replace your current profile with this role template?"))return;state.profile=ROLE_TEMPLATES[title].map(([skill,level,years])=>({skill,level,years}));if(await persist(`${title} profile loaded.`))render("profile");return;}
  if(target.dataset.sample!==undefined){loadSample(Number(target.dataset.sample));return;}
  if(target.dataset.action==="analyze"){await analyzeDraft();return;}
  if(target.dataset.action==="export"){exportState(state);return;}
  if(target.dataset.action==="import"){const picker=document.createElement("input");picker.type="file";picker.accept="application/json,.json";picker.addEventListener("change",async()=>{const file=picker.files?.[0];if(!file)return;try{const imported=parseImport(await file.text());const previous=state;state=imported;if(await persist("Data imported successfully.")){currentAnalysisId=null;legacyState=null;render(currentRoute);}else{state=previous;}}catch(error){notify(error instanceof Error?error.message:"Unable to import this file.");}});picker.click();return;}
  if(target.dataset.action==="migrate-legacy"){if(!legacyState)return;if(!confirm("Copy the data from this browser into your signed-in account? This replaces the current account data."))return;const previous=state;state=legacyState;if(await persist("Previous browser data imported into your account.")){legacyState=null;try{localStorage.removeItem("skill-gap-analyzer:v1");}catch(error){console.warn("The old browser copy could not be removed.",error);}render("profile");}else state=previous;return;}
  if(target.dataset.action==="reset"){if(confirm("Reset your profile, analyses, and learning plan? This cannot be undone.")){await clearState();state={profile:[],analyses:[],plan:[],settings:{theme:"dark"}};currentAnalysisId=null;legacyState=null;applyTheme();render("profile");notify("All account data reset.");}return;}
  if(target.dataset.action==="parse-resume"){const result=extractSkills($("#resume-text").value);const container=$("#resume-suggestions");if(!result.hasSkills){container.textContent="No supported skills found. Add more detail to the resume text.";return;}container.innerHTML=result.skills.filter(item=>!state.profile.some(skill=>skill.skill===item.skill)).map(item=>`<button type="button" class="button small" data-resume-skill="${esc(item.skill)}">+ ${esc(pretty(item.skill))} · Add at level 3</button>`).join("")||"<span class=\"muted\">Every detected skill is already in your profile.</span>";return;}
  if(target.dataset.resumeSkill){await addProfileSkill(target.dataset.resumeSkill,3,0);return;}
  if(target.dataset.addPlan){const skill=target.dataset.addPlan;if(!state.plan.some(item=>item.skill===skill)){state.plan.push({skill,done:false,targetDate:daysFromNow(30)});if(await persist(`${pretty(skill)} added to your plan.`))render("results");}else notify(`${pretty(skill)} is already in your plan.`);return;}
  if(target.dataset.openAnalysis){currentAnalysisId=target.dataset.openAnalysis;whatIf.clear();location.hash="#/results";return;}
  if(target.dataset.deleteAnalysis){if(confirm("Delete this analysis from history?")){state.analyses=state.analyses.filter(item=>item.id!==target.dataset.deleteAnalysis);if(await persist("Analysis deleted."))render("history");}return;}
  if(target.dataset.action==="compare"){compareSelected();}
}
app.addEventListener("click",event=>{handleClick(event).catch(error=>notify(error instanceof Error?error.message:"The request could not be completed."));});
app.addEventListener("submit",async event=>{
  event.preventDefault();
  if(event.target.id==="auth-form") {
    const form=event.target,submit=$(".auth-submit",form),error=$("#auth-error");
    submit.disabled=true;error.textContent="";
    try {
      const values=new FormData(form),path=authMode==="login"?"/auth/login":"/auth/register";
      currentUser=await apiRequest(path,{method:"POST",body:JSON.stringify({email:values.get("email"),password:values.get("password")})});
      state=await loadState();legacyState=getLegacyState();currentAnalysisId=null;whatIf.clear();showAccount();applyTheme();render("profile");history.replaceState(null,"",`${location.pathname}${location.search}#/profile`);
    } catch(failure) {error.textContent=failure instanceof Error?failure.message:"Unable to sign in.";submit.disabled=false;}
    return;
  }
  if(event.target.id!=="add-skill-form")return;
  const data=new FormData(event.target),raw=String(data.get("skill")).trim().toLowerCase();
  const skill=Object.keys(SKILLS).find(name=>name===raw||SKILLS[name].aliases.includes(raw));
  if(!skill){notify("Select a skill from the suggestions.");return;}
  await addProfileSkill(skill,data.get("level"),data.get("years"));
});
app.addEventListener("input",event=>{
  if(event.target.id==="skill-entry"){suggestionIndex=-1;showSuggestions();}
  if(event.target.id==="jd-text"){$("#jd-count").textContent=`${event.target.value.length.toLocaleString()} / 50,000 characters`;state.draft={...(state.draft??{}),jdText:event.target.value};}
  if(event.target.id==="job-title")state.draft={...(state.draft??{}),jobTitle:event.target.value};
  if(event.target.id==="company")state.draft={...(state.draft??{}),company:event.target.value};
});
app.addEventListener("keydown",event=>{
  if(event.target.id!=="skill-entry")return;
  const options=[...$("#skill-suggestions").querySelectorAll("[data-suggest]")];
  if(event.key==="ArrowDown"&&options.length){event.preventDefault();suggestionIndex=(suggestionIndex+1)%options.length;showSuggestions();$("#skill-entry").setAttribute("aria-activedescendant",`suggestion-${suggestionIndex}`);}
  else if(event.key==="ArrowUp"&&options.length){event.preventDefault();suggestionIndex=(suggestionIndex-1+options.length)%options.length;showSuggestions();$("#skill-entry").setAttribute("aria-activedescendant",`suggestion-${suggestionIndex}`);}
  else if(event.key==="Enter"&&suggestionIndex>=0){event.preventDefault();options[suggestionIndex].click();}
  else if(event.key==="Escape"){$("#skill-suggestions").hidden=true;event.target.setAttribute("aria-expanded","false");}
});
app.addEventListener("change",async event=>{
  const target=event.target;
  if(target.dataset.profileLevel){const item=state.profile.find(skill=>skill.skill===target.dataset.profileLevel);if(item){item.level=Number(target.value);await persist();}}
  if(target.dataset.profileYears){const item=state.profile.find(skill=>skill.skill===target.dataset.profileYears);if(item){const years=Number(target.value);if(Number.isFinite(years)&&years>=0&&years<=60){item.years=years;await persist();}else{target.value=String(item.years);notify("Years of experience must be between 0 and 60.");}}}
  if(target.dataset.whatif){if(target.checked)whatIf.add(target.dataset.whatif);else whatIf.delete(target.dataset.whatif);render("results");}
  if(target.dataset.planDone){const item=state.plan.find(skill=>skill.skill===target.dataset.planDone);if(item){item.done=target.checked;if(await persist("Plan progress saved."))render("plan");}}
  if(target.dataset.planDate){const item=state.plan.find(skill=>skill.skill===target.dataset.planDate);if(item){item.targetDate=target.value;await persist("Target date saved.");}}
  if(target.id==="trend-title")updateTrend();
});
document.querySelector("#theme-toggle").addEventListener("click",async()=>{
  state.settings.theme=state.settings.theme==="dark"?"light":"dark";await persist("Theme preference saved.");
});
$("#signout-button").addEventListener("click",async()=>{
  try { await apiRequest("/auth/logout",{method:"POST"});currentUser=null;legacyState=null;currentAnalysisId=null;whatIf.clear();authMode="login";showAccount();renderAuth("You have signed out."); }
  catch(error) {notify(error instanceof Error?error.message:"Unable to sign out.");}
});
window.addEventListener("skillgap:unauthorized",()=>{currentUser=null;legacyState=null;currentAnalysisId=null;whatIf.clear();authMode="login";renderAuth("Your session expired. Please sign in again.");});
let authReady=false;
initializeRouter(route=>{if(currentUser)render(route);else if(authReady)renderAuth();},()=>state.profile.length>0);
async function bootstrap() {
  try {
    currentUser=await apiRequest("/auth/me");
  } catch(error) {
    if(error.status===401) {
      currentUser=null;
      renderAuth();
      return;
    }
    showAccount();
    app.innerHTML=`<section class="card service-error"><div class="eyebrow">Connection problem</div><h1>We couldn’t reach the Skill Gap Analyzer server</h1><p class="lede">${esc(error.message)}</p><button class="button primary" data-action="retry">Try again</button></section>`;
    return;
  } finally {authReady=true;}
  try {
    state=await loadState();
    legacyState=getLegacyState();
    showAccount();applyTheme();render(location.hash==="#/analyze"?"analyze":location.hash==="#/results"?"results":location.hash==="#/history"?"history":location.hash==="#/plan"?"plan":"profile");
  } catch(error) {
    showAccount();
    app.innerHTML=`<section class="card service-error"><div class="eyebrow">Data error</div><h1>Unable to load your saved data</h1><p class="lede">${esc(error.message)}</p><button class="button primary" data-action="retry">Try again</button></section>`;
  }
}
app.addEventListener("click",event=>{if(event.target.closest("[data-action='retry']"))bootstrap();});
bootstrap();
