# TSI Contract Studio

Browser-based contract assembly, management, and review-tracking for TSI equipment supply agreements (ESAs). Standalone HTML/CSS/JS — no backend, no build step, no dependencies. Files are the database.

Built to the [project specification](TSI-CONTRACT-STUDIO-SPEC.md) (v0.2).

## Quick start

The app reads files with `fetch()`, which needs a web server — it does **not** work over `file://`.

```bash
cd TSI-Contract-Studio        # the folder that contains studio/
python -m http.server 8080
# open http://localhost:8080/studio/index.html
```

Or use the VS Code **Live Server** extension: right-click `studio/index.html` → Open with Live Server.

Recommended browser: **Chrome or Edge** (full read/write via the File System Access API). Firefox works read-only; saving falls back to download-and-replace.

## Modules

| Page | Module | What it does |
| --- | --- | --- |
| `studio/index.html` | Dashboard | Portfolio KPIs, module launcher, all-projects summary |
| `studio/assembly.html` | 1 · Contract assembly | Create a project; cover sheet auto-populates; stubs and annexes inject from the library; Working / Clean / Print views; defined-term tooltips; % LD caps show dollar amounts on hover; **Export clean** (Module 4) strips internal markup, version-stamps, and appends to the export log |
| `studio/stubs.html` | 2 · Stub manager | List reusable clauses, view content, diff a stub against its previous version, record Attorney / JT sign-off |
| `studio/tracker.html` | 3 · Review tracker | Per-project section/annex status + notes, completion and "ready to package"; all-projects roll-up |

## Layout

```
studio/          the app (index, assembly, stubs, tracker + studio.css/js, diff.js)
templates/       master-agreement.html — the ESA base (22 articles + A–R annexes)
stubs/           10 reusable legal clauses + versions/ archive
document-library/  forms · technical · commercial — annex source documents
projects/        one folder per project (project.json is the state) + index.json
config/          stub-registry.json · doc-library-registry.json (directory indexes)
assets/          TSI logos
```

State lives in JSON files. There is no directory scan — `config/*.json` and `projects/index.json` are the indexes; the app updates them on save (or maintain by hand).

## Design system

Visuals follow the canonical **TSI design system** (`tsi-style`): Inter + DM Serif Display + JetBrains Mono, warm off-white surfaces, hairline borders, no shadows, all numbers in mono. `studio/studio.css` vendors the base tokens and the component classes so the app stays dependency-free. The spec's older inline "house style" (Open Sans) is intentionally superseded.

Internal editorial markup — `.draft-note` `[DRAFT NOTE]`, `.int-note` `[INT]`, `.atty-note` `[ATTY]`, `.open-issue` `[OPEN]` — is visible in Working view, hidden in Clean/Print, and stripped from exports.

## Notes & open items

- **Fonts** load from Google Fonts (matching `tsi-style`); on a locked-down/offline machine the stack falls back to Aptos (M365) then system-ui. Vendor the font files locally if full offline fidelity is needed.
- The stubs and library documents are **template-grade** boilerplate marked for attorney review, not final legal text.
- Intel handoff: `assembly.html?project=new&buyer=…&site=…&price=…` prefills the new-project form.
