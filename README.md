# Skill Gap Analyzer

A private, offline-capable single-page app for comparing a job description with a personal skills profile. It uses vanilla HTML, CSS, and JavaScript modules; there is no build step, backend, or third-party runtime dependency.

## Run locally

From this folder, start any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000` in a modern browser. ES modules require HTTP(S), so opening the HTML directly as a `file:` URL may be blocked by browser security policy. The app itself makes no network requests and continues to work offline once served.

## How readiness is calculated

For each detected skill, its weight is the number of mentions, plus 3 when it appears in a required section and 2 when it appears in the job title. Skills found only in a preferred section have their weight halved. A profile match contributes its full weight, a partial match contributes half, and a missing skill contributes zero:

`readiness = round(100 × Σ(weight × match factor) / Σ(weight))`

A match requires proficiency level 3 or higher and, when the JD specifies years for that skill, enough years of experience. Missing-skill priority is `weight × (1 + 0.2 × related skills already owned) / estimated learning hours`, sorted from highest to lowest. These keyword-based estimates are directional, not hiring predictions.

## Data and privacy

Profile, history, plan, and theme are stored under one versioned local-storage key. If browser storage is unavailable, the app continues in memory for the current session. Use **Export JSON** and **Import JSON** to back up or restore the complete state. Import validates the data shape before replacing existing data.

## Included features

- Five hash-routed views: profile, analyze, results, learning plan, and history.
- 70+ searchable skills, profile role templates, sample job descriptions, and resume-text skill suggestions.
- Matched/partial/missing analysis, weighted readiness, accessible SVG radar and score ring, highlighted job text, what-if gap selection, prioritized learning resources, history trends, and multi-role gap comparison.
- Keyboard-operable autocomplete, responsive dark/light themes, confirmation before destructive reset/template replacement, and reduced-motion support.
