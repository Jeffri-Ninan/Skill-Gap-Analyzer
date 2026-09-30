import assert from "node:assert/strict";
import {extractSkills} from "../js/extractor.js";
import {ROLE_TEMPLATES,SAMPLE_JDS} from "../js/skills-data.js";
import {analyze} from "../js/analyzer.js";

const edgeCases=extractSkills("C++ and C# are required. Node.js experience. We go to work on projects.\nGo services are a plus.","Software Engineer");
const edgeSkills=new Map(edgeCases.skills.map(item=>[item.skill,item]));
for(const skill of ["c++","c#","node.js","go"])assert.ok(edgeSkills.has(skill),`${skill} should be detected`);
assert.equal(edgeSkills.get("go").mentions,1,"ordinary lowercase 'go' should not be treated as a skill");

const sections=extractSkills("Python is central to the role.\nRequirements\n3+ years of Python required.\nPreferred\nReact is a plus.","");
const python=sections.skills.find(item=>item.skill==="python");
const react=sections.skills.find(item=>item.skill==="react");
assert.equal(python.yearsRequired,3);
assert.equal(python.inRequiredSection,true);
assert.equal(react.inOptionalSection,true);
assert.equal(react.weight,.5,"preferred-only skills should have half weight");

const sample=extractSkills(SAMPLE_JDS[0].text,SAMPLE_JDS[0].title);
const profile=ROLE_TEMPLATES["Frontend Developer"].map(([skill,level,years])=>({skill,level,years}));
const result=analyze(sample.skills,profile);
assert.ok(result.score>0&&result.score<100,"sample role should produce a useful non-extreme score");
assert.ok(result.gaps.length>0,"sample role should produce prioritized learning gaps");
assert.ok(result.gaps.every((item,index,list)=>index===0||list[index-1].priority>=item.priority),"gaps should be sorted by descending priority");
console.log("Extractor/analyzer checks passed.",{detected:edgeSkills.size,score:result.score,topGap:result.gaps[0].skill});
