const entries = {
  "javascript":["Programming",40,["typescript","react"],["MDN JavaScript Guide","Build an interactive dashboard"]],
  "typescript":["Programming",35,["javascript","react"],["TypeScript Handbook","Convert a JavaScript project"]],
  "python":["Programming",45,["sql","pandas"],["Python tutorial","Automate a practical task"]],
  "java":["Programming",55,["spring","sql"],["Dev.java learning paths"]],
  "c++":["Programming",60,["c","algorithms"],["LearnCpp","Implement a small systems project"]],
  "c#":["Programming",50,[".net","sql"],["Microsoft C# guide"]],
  "go":["Programming",45,["docker","backend development"],["A Tour of Go"]],
  "rust":["Programming",70,["c++","systems design"],["The Rust Book"]],
  "swift":["Programming",45,["ios","swiftui"],["Swift documentation"]],
  "kotlin":["Programming",45,["java","android"],["Kotlin docs"]],
  "php":["Programming",40,["laravel","sql"],["PHP manual"]],
  "ruby":["Programming",40,["rails","sql"],["Ruby in 20 minutes"]],
  "r":["Programming",35,["statistics","data analysis"],["R for Data Science"]],
  "html":["Frontend",15,["css","javascript"],["MDN HTML guide"]],
  "css":["Frontend",25,["html","javascript"],["MDN CSS guide"]],
  "react":["Frontend",40,["javascript","next.js"],["React documentation","Build a small dashboard project"]],
  "vue":["Frontend",35,["javascript","html"],["Vue guide"]],
  "angular":["Frontend",50,["typescript","javascript"],["Angular tutorial"]],
  "next.js":["Frontend",35,["react","javascript"],["Next.js learn course"]],
  "svelte":["Frontend",30,["javascript","html"],["Svelte tutorial"]],
  "accessibility":["Frontend",25,["html","css"],["W3C WAI tutorials"]],
  "responsive design":["Frontend",18,["css","html"],["MDN responsive design"]],
  "web performance":["Frontend",24,["javascript","css"],["web.dev performance"]],
  "webpack":["Frontend",20,["javascript","vite"],["Webpack concepts"]],
  "vite":["Frontend",12,["javascript","typescript"],["Vite guide"]],
  "node.js":["Backend",40,["javascript","express"],["Node.js learning guide"]],
  "express":["Backend",25,["node.js","javascript"],["Express getting started"]],
  "django":["Backend",40,["python","sql"],["Django tutorial"]],
  "flask":["Backend",30,["python","sql"],["Flask quickstart"]],
  "spring":["Backend",50,["java","sql"],["Spring guides"]],
  "rest apis":["Backend",25,["http","node.js"],["MDN HTTP overview"]],
  "graphql":["Backend",35,["javascript","rest apis"],["GraphQL learn"]],
  "microservices":["Backend",55,["docker","backend development"],["Microsoft microservices guide"]],
  "backend development":["Backend",40,["node.js","sql"],["Build a REST service"]],
  "mongodb":["Data",28,["node.js","sql"],["MongoDB university"]],
  "sql":["Data",35,["postgresql","data modeling"],["SQLBolt"]],
  "postgresql":["Data",30,["sql","data modeling"],["PostgreSQL tutorial"]],
  "mysql":["Data",28,["sql","data modeling"],["MySQL tutorial"]],
  "pandas":["Data",28,["python","data analysis"],["10 minutes to pandas"]],
  "numpy":["Data",28,["python","pandas"],["NumPy quickstart"]],
  "data analysis":["Data",35,["sql","python"],["Analyze a public dataset"]],
  "data visualization":["Data",28,["tableau","python"],["Storytelling with data"]],
  "tableau":["Data",30,["data visualization","sql"],["Tableau free training"]],
  "power bi":["Data",30,["data visualization","sql"],["Microsoft Power BI learning"]],
  "statistics":["Data",38,["python","r"],["Khan Academy statistics"]],
  "machine learning":["Data",65,["python","statistics"],["Google ML crash course"]],
  "etl":["Data",35,["sql","data modeling"],["Build an ETL pipeline"]],
  "data modeling":["Data",32,["sql","postgresql"],["Database design basics"]],
  "aws":["Cloud/DevOps",50,["docker","ci/cd"],["AWS Skill Builder"]],
  "azure":["Cloud/DevOps",48,["docker","ci/cd"],["Microsoft Learn Azure"]],
  "google cloud":["Cloud/DevOps",48,["docker","kubernetes"],["Google Cloud skills"]],
  "docker":["Cloud/DevOps",28,["kubernetes","ci/cd"],["Docker getting started"]],
  "kubernetes":["Cloud/DevOps",55,["docker","aws"],["Kubernetes basics"]],
  "ci/cd":["Cloud/DevOps",24,["git","docker"],["GitHub Actions documentation"]],
  "terraform":["Cloud/DevOps",40,["aws","ci/cd"],["HashiCorp tutorials"]],
  "linux":["Cloud/DevOps",30,["bash","docker"],["Linux command line basics"]],
  "bash":["Cloud/DevOps",20,["linux","python"],["Bash manual"]],
  "git":["Tools",12,["github","ci/cd"],["Pro Git book"]],
  "github":["Tools",10,["git","ci/cd"],["GitHub Skills"]],
  "agile":["Tools",20,["scrum","project management"],["Agile principles"]],
  "scrum":["Tools",18,["agile","jira"],["Scrum guide"]],
  "jira":["Tools",10,["agile","project management"],["Atlassian Jira tutorials"]],
  "figma":["Tools",15,["design systems","user research"],["Figma learning resources"]],
  "excel":["Tools",18,["sql","data analysis"],["Excel training"]],
  "communication":["Soft Skills",20,["presentation skills","writing"],["Practice concise project updates"]],
  "problem solving":["Soft Skills",24,["critical thinking","systems design"],["Work through structured case studies"]],
  "teamwork":["Soft Skills",15,["communication","cross-functional collaboration"],["Reflect on a team project"]],
  "leadership":["Soft Skills",30,["communication","stakeholder management"],["Lead a small initiative"]],
  "stakeholder management":["Soft Skills",24,["communication","project management"],["Practice stakeholder mapping"]],
  "cross-functional collaboration":["Soft Skills",20,["teamwork","communication"],["Facilitate a cross-team project"]],
  "project management":["Soft Skills",28,["agile","stakeholder management"],["Plan and deliver a small project"]],
  "presentation skills":["Soft Skills",18,["communication","data visualization"],["Present a short project demo"]],
  "writing":["Soft Skills",16,["communication","documentation"],["Write clear technical documentation"]],
  "critical thinking":["Soft Skills",24,["problem solving","statistics"],["Practice evidence-based decisions"]],
  "documentation":["Soft Skills",14,["writing","javascript"],["Document a project as you build"]]
};

export const SKILLS = Object.fromEntries(Object.entries(entries).map(([name,[category,learningHours,related,resources]]) => {
  const aliases = {
    "javascript":["js"],"typescript":["ts"],"c++":["cpp"],"c#":["c sharp"],"node.js":["nodejs","node js"],
    "next.js":["nextjs","next js"],"vue":["vue.js","vuejs"],"react":["react.js","reactjs"],
    "rest apis":["rest api","restful apis","restful api"],"ci/cd":["continuous integration","continuous delivery"],
    "cross-functional collaboration":["cross functional collaboration"],"power bi":["powerbi"],
    "google cloud":["gcp"],"mongodb":["mongo db"],"postgresql":["postgres"],"html":["html5"],
    "css":["css3"],"c++":["cpp"],"c#":["c sharp"],"r":["r language"],"go":["golang"],
    "spring":["spring framework"],"swift":["swift language"]
  }[name] ?? [];
  return [name,{aliases,category,learningHours,related,resources}];
}));

export const CATEGORIES = [...new Set(Object.values(SKILLS).map(skill => skill.category))];

export const ROLE_TEMPLATES = {
  "Frontend Developer":[
    ["javascript",5,4],["typescript",4,2],["react",4,3],["html",5,5],["css",4,4],["git",4,3],["accessibility",3,1],["responsive design",4,3],["communication",4,3],["vite",3,1]
  ],
  "Data Analyst":[
    ["sql",4,3],["python",3,2],["pandas",3,1],["excel",5,5],["tableau",3,2],["statistics",3,2],["data visualization",4,2],["communication",4,4],["power bi",2,1]
  ],
  "Product Manager":[
    ["agile",4,4],["scrum",4,3],["jira",4,3],["project management",4,5],["stakeholder management",4,4],["communication",5,6],["leadership",3,2],["data analysis",3,2],["presentation skills",4,3],["cross-functional collaboration",4,3]
  ]
};

export const SAMPLE_JDS = [
  {title:"Frontend Developer",company:"Northstar Labs",text:`Frontend Developer — Northstar Labs

Requirements
• 3+ years of JavaScript and 2+ years of React experience
• Strong TypeScript, HTML, CSS, responsive design, and accessibility
• Experience with Git, REST APIs, and modern build tools such as Vite
• Build performant interfaces and collaborate across product and design

Preferred
• Next.js, automated testing, and CI/CD
• Excellent communication and cross-functional collaboration`},
  {title:"Data Analyst",company:"Brightside Health",text:`Data Analyst — Brightside Health

Qualifications
• 3+ years of SQL and experience with Python and pandas
• Strong statistics, data analysis, and data visualization skills
• Create dashboards with Tableau or Power BI and present insights clearly
• Excellent communication and stakeholder management

Nice to have
• Machine learning, AWS, and experience building ETL pipelines
• Knowledge of PostgreSQL and data modeling`}
];
