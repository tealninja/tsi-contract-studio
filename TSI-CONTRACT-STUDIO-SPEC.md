# TSI Contract Studio
## Project Specification v0.2
### Teal Sales Incorporated — Internal Tool

---

## What This Is

A browser-based contract assembly, management, and review-tracking system for TSI's equipment supply agreements. Built as a standalone HTML/JS/CSS application that reads and writes files from a local folder structure synced to SharePoint via OneDrive. No backend server. No API authentication. No SaaS dependency. TSI owns the code and the data.

---

## Core Philosophy

- **Modular contract architecture**: main agreement + reusable legal stubs + document library annexes
- **Functional expert review**: each annex has a designated reviewer; attorney reviews legal stubs once, not every contract
- **One master working file per project**: internal HTML version with drafting notes; clean export for counterparty
- **Diff awareness**: any stub modified from the approved library version is flagged and diffed
- **No routing engine**: review tracking is John's internal dashboard only — no notifications, no external workflow
- **Files are the database**: all state lives in JSON files in the folder structure; no database required

---

## Storage Architecture

### How It Works

SharePoint is synced to Windows Explorer via the OneDrive sync client. The `TSI-Contract-Studio` folder appears as a normal local folder. The app reads and writes files using relative paths — no API calls, no authentication, no CORS issues.

```
[Local Drive — OneDrive Synced]
C:\Users\[User]\[Company]\TSI-Contract-Studio\
    └── automatically syncs to SharePoint
```

### Opening the App

The app must be opened via a local web server (not `file://` protocol) to allow `fetch()` calls for relative file reads. Two options:

**Option A — Python (one command, always available):**
```bash
cd "C:\Users\[User]\[Company]\TSI-Contract-Studio\studio"
python -m http.server 8080
# Open: http://localhost:8080
```

**Option B — VS Code Live Server:**
- Install Live Server extension
- Right-click `studio/index.html` → Open with Live Server
- Auto-reloads on file save

Either option runs locally; nothing leaves the machine except the OneDrive sync.

---

## File / Folder Structure

```
TSI-Contract-Studio/
│
├── studio/                           ← the app (open index.html via localhost)
│   ├── index.html                    ← main entry point / dashboard
│   ├── assembly.html                 ← module 1: contract assembly
│   ├── stubs.html                    ← module 2: stub manager
│   ├── tracker.html                  ← module 3: review tracker
│   ├── studio.css                    ← shared styles (TSI house style)
│   ├── studio.js                     ← shared utilities, file I/O helpers
│   └── diff.js                       ← diff-match-patch (Google OSS, single file)
│
├── templates/
│   └── master-agreement.html         ← the master contract template
│
├── stubs/
│   ├── ip-license.html
│   ├── indemnification.html
│   ├── limitation-of-liability.html
│   ├── confidentiality.html
│   ├── force-majeure.html
│   ├── dispute-resolution.html
│   ├── governing-law.html
│   ├── representations-warranties.html
│   ├── insurance.html
│   ├── anti-corruption.html
│   └── versions/                     ← archived previous stub versions
│       └── ip-license_v1.0.html
│
├── document-library/
│   ├── forms/
│   │   ├── form-change-order.html
│   │   ├── form-certificate-completion.html
│   │   ├── form-lien-waiver-conditional.html
│   │   ├── form-lien-waiver-unconditional.html
│   │   ├── form-commissioning-notice.html
│   │   ├── form-milestone-certificate.html
│   │   └── form-notice-of-readiness.html
│   ├── technical/
│   │   ├── mill-standards-electrical.html
│   │   ├── mill-standards-mechanical.html
│   │   ├── mill-standards-controls.html
│   │   ├── mill-standards-coatings.html
│   │   ├── performance-test-protocol.html
│   │   ├── installation-precommissioning-requirements.html
│   │   └── responsibility-matrix-blank.html
│   └── commercial/
│       ├── warranty-standard.html
│       ├── insurance-schedule.html
│       └── buyer-info-form-blank.html
│
├── projects/
│   └── [ProjectName]-[YYYY]/
│       ├── project.json              ← project metadata + review state
│       ├── contract-working.html     ← assembled working document (internal)
│       └── exports/
│           └── TSI_ESA_[Name]_v1.0_[Date].html
│
└── config/
    ├── stub-registry.json            ← stub versions, approval dates, reviewer status
    └── doc-library-registry.json     ← document library index + reviewer assignments
```

---

## File I/O Model

All file operations use the browser `fetch()` API with relative paths from the `studio/` directory.

### Reading files (stubs, templates, documents)
```javascript
// From studio/, all paths are relative to the server root (TSI-Contract-Studio/)
const stub = await fetch('../stubs/ip-license.html').then(r => r.text());
const project = await fetch('../projects/berneck-2025/project.json').then(r => r.json());
```

### Writing files (project state, assembled contracts)
```javascript
// Use the File System Access API (Chrome/Edge, no server needed)
const fileHandle = await window.showSaveFilePicker({ suggestedName: 'project.json' });
const writable = await fileHandle.createWritable();
await writable.write(JSON.stringify(projectData, null, 2));
await writable.close();
```

**Note on writes:** The File System Access API requires a user gesture (button click) and a file picker on first save per session. On subsequent saves to the same handle (stored in memory), it writes silently. This is acceptable for the workflow — user clicks Save, picker appears once, subsequent auto-saves are silent.

**Alternative for writes:** If File System Access API friction is too high, project state can be exported as a downloadable JSON file (using a `<a download>` link) and the user places it in the correct folder. Slightly more manual but zero API complexity.

### Directory listing (populating stub/document library UI)
```javascript
// Registry files serve as the directory index — no filesystem scan needed
const registry = await fetch('../config/stub-registry.json').then(r => r.json());
```

Registry files are maintained manually (or auto-updated by the app on save). This avoids the need for server-side directory listing.

---

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| App shell | Vanilla HTML5 / CSS3 / ES6 JS | No framework, no build step, zero dependencies |
| File reads | `fetch()` with relative paths | Works via localhost; does NOT work on `file://` protocol |
| File writes | File System Access API | Chrome/Edge; user-gesture required on first save |
| Local server | Python `http.server` or VS Code Live Server | One command; no install beyond Python |
| Diff engine | diff-match-patch (Google OSS) | Single JS file, no install |
| Styles | Custom CSS, TSI house style | CSS variables for theming |
| State | project.json per project, flat files | No database |
| PDF export | Browser print + CSS `@media print` | No dependency |
| Word export | Open clean HTML in Word → Save As .docx | Imperfect but practical |
| Version control | Git (optional) | Repo tracks studio/ code; projects/ and stubs/ optionally included |

**Removed from stack:** MSAL.js, Microsoft Graph API, Azure AD app registration — not needed.

---

## Data Model

### config/stub-registry.json
```json
{
  "stubs": [
    {
      "id": "ip-license",
      "name": "IP Ownership & License",
      "file": "stubs/ip-license.html",
      "version": "1.1",
      "approvedDate": "2025-01-15",
      "reviewers": {
        "attorney": { "done": true, "date": "2025-01-15" },
        "jt": { "done": true, "date": "2025-01-10" }
      },
      "changelog": [
        { "version": "1.1", "date": "2025-01-15", "note": "Added reverse engineering carve-out" },
        { "version": "1.0", "date": "2024-11-01", "note": "Initial version" }
      ]
    }
  ]
}
```

### projects/[name]/project.json
```json
{
  "id": "berneck-dryer-2025",
  "name": "Berneck Dryer Island Rebuild",
  "buyer": "Berneck S.A.",
  "buyerAddress": "Araucária, Paraná, Brazil",
  "buyerNotices": "Legal Department",
  "site": "Araucária, Brazil",
  "contractPrice": 1815850,
  "effectiveDate": "2025-01-01",
  "warrantyPeriod": "12 months from Commissioning Completion",
  "governingLaw": "Washington",
  "delayLDGracePeriod": 2,
  "delayLDRate": 1,
  "delayLDCap": 10,
  "performanceLDCap": 10,
  "aggregateLDCap": 15,
  "minPerformanceThreshold": 80,
  "changeOrderMarkup": 20,
  "terminationFeePercent": 20,
  "status": "In Review",
  "createdAt": "2025-01-01T00:00:00Z",
  "lastModified": "2025-01-10T00:00:00Z",
  "sections": [
    {
      "id": "cover",
      "name": "Cover Sheet",
      "reviewer": "JT",
      "status": "done",
      "completedAt": "2025-01-05T00:00:00Z",
      "notes": ""
    },
    {
      "id": "article-9",
      "name": "Article 9 — Intellectual Property",
      "stubId": "ip-license",
      "stubVersion": "1.1",
      "modified": false,
      "reviewer": "Attorney",
      "status": "pending",
      "notes": ""
    }
  ],
  "annexes": [
    {
      "id": "annex-n",
      "letter": "N",
      "name": "Insurance Requirements",
      "sourceDoc": "commercial/insurance-schedule",
      "reviewer": "CFO",
      "status": "pending",
      "notes": ""
    }
  ],
  "exportLog": [
    {
      "version": "1.0",
      "date": "2025-01-10T00:00:00Z",
      "filename": "TSI_ESA_Berneck_v1.0_2025-01-10.html"
    }
  ]
}
```

---

## Application Modules

### Module 1: Contract Assembly
- Create new project — name, buyer, site, contract price, effective date, governing law
- Cover sheet fields auto-populate from project data
- Key commercial terms set once on cover, referenced throughout document
- Stubs auto-insert into designated article slots from stub registry
- Annexes selected from document library
- Defined terms engine: hover any defined term → tooltip; click → jumps to Article 1
- Calculated fields: hover any % LD cap → shows dollar amount at current contract price
- View toggle:
  - **Working View** — all drafting notes, internal flags, reviewer callouts visible
  - **Clean View** — all internal markup hidden; what counterparty sees
  - **Print View** — `@media print` CSS, paginated, clean

### Module 2: Stub Manager
- Lists all stubs from stub-registry.json
- View stub content inline
- Diff view: side-by-side vs. previous version (diff-match-patch)
- Reviewer checkboxes (Attorney / JT / other) — saved to stub-registry.json
- Per-project: if stub text was modified in the assembled contract, flagged as "Modified from standard v[X.X]" and diff shown vs. library version
- Reviewer checkboxes reset when a stub is modified in a project

### Module 3: Review Tracker
Dashboard — one view per project, one summary view across all projects.

**Per-project view:**
```
PROJECT: Berneck Dryer Island Rebuild         Status: In Review
─────────────────────────────────────────────────────────────────
SECTION                      REVIEWER    STATUS        NOTES
Cover Sheet                  JT          ✓ Done
Art. 1  Definitions          Attorney    ○ Pending
Art. 2  Scope of Work        JT / PM     ● In Progress
Art. 9  IP (stub v1.1)       Attorney    ✓ Done
...
Annex N  Insurance           CFO         ○ Pending
Annex O  Electrical Stds     Elec. Eng.  ✓ Done
─────────────────────────────────────────────────────────────────
COMPLETE: 7 of 18 sections    READY TO PACKAGE: No
```

John marks sections done. No notifications. No routing.

**All-projects summary:**
- One row per active project
- % complete, status, last modified
- Flag: Ready to Package (all required sections done)

### Module 4: Export
- Clean HTML — strips `.internal-note`, `.draft-note`, `.atty-note`, `.open-issue` elements
- Print via browser (`Ctrl+P`) using `@media print` stylesheet
- Version stamp: `TSI_ESA_[ProjectName]_v[X.X]_[Date]`
- Export log appended to project.json
- Word guidance note: *"Open this file in Microsoft Word and Save As .docx for attorney/counterparty exchange."*

---

## TSI House Style

```css
:root {
  --deep-blue:  #19446C;
  --teal:       #00929F;
  --sage:       #809848;
  --charcoal:   #404040;
  --light-bg:   #F4F7FA;
  --border:     #D0DCE8;
  --white:      #FFFFFF;
  --font:       'Open Sans', system-ui, sans-serif;
}
```

Typography: Open Sans throughout. Article headers in Deep Blue. Accents and links in Teal. Tags and status labels in Sage. Body text in Charcoal.

---

## Internal Markup Convention

All internal-only content uses CSS classes with color coding. Hidden in Clean View via `display: none`. Stripped in exported HTML by removing all elements with these classes before saving.

| CSS Class | Color | Tag Convention | Purpose |
|---|---|---|---|
| `.draft-note` | Red `#C62828` | `[DRAFT NOTE: ...]` | Drafter instructions — strip before first send |
| `.int-note` | Orange `#E65100` | `[INT: ...]` | Internal commentary — never leaves TSI |
| `.atty-note` | Purple `#6A1B9A` | `[ATTY: ...]` | Flag for attorney review |
| `.open-issue` | Red `#C62828` | `[OPEN: ...]` | Unresolved issue — must close before sending |

Toggle in UI: **Working View** shows all; **Clean View** hides all via:
```css
.working-view-only { display: none; }
/* In working mode: */
.working-view-only { display: block; }
```

---

## Contract Structure (Master Agreement)

### Cover Sheet
- Parties & notice addresses
- Project particulars table
- Contract price & key commercial terms table
- Scope inclusions (drafting note format — not checkboxes)
- Milestone payment summary (reference only — Annex E governs; note to this effect on cover)
- Annex list with reviewer column (visible in Working View only)
- Signatures

### Terms & Conditions (Articles 1–22)
| Article | Title | Stub |
|---|---|---|
| 1 | Definitions | — |
| 2 | Scope of Work & Engineering | — |
| 3 | Delivery, Title & Risk of Loss | — |
| 4 | Liquidated Damages | — |
| 5 | Commissioning | — |
| 6 | Performance Testing | — |
| 7 | Contract Price & Payment | — |
| 8 | Change Orders | — |
| 9 | Intellectual Property | `ip-license` |
| 10 | Warranty | — |
| 11 | Spare Parts | — |
| 12 | Indemnification | `indemnification` |
| 13 | Insurance | `insurance` |
| 14 | Limitation of Liability | `limitation-of-liability` |
| 15 | Events of Default & Remedies | — |
| 16 | Force Majeure | `force-majeure` |
| 17 | Representations & Warranties | `representations-warranties` |
| 18 | Confidentiality | `confidentiality` |
| 19 | Compliance with Laws | `anti-corruption` |
| 20 | Change in Law | — |
| 21 | Dispute Resolution | `dispute-resolution` + `governing-law` |
| 22 | Miscellaneous | — |

### Annexes (chronological / project lifecycle order)
| Letter | Title | Reviewer |
|---|---|---|
| A | Scope of Work Summary | PM / Engineering |
| B | Responsibility Matrix | PM / Engineering |
| C | Buyer-Provided Information | Engineering |
| D | Project Schedule | PM |
| E | Milestone Payment Schedule & Definitions of Completion | PM / Commercial |
| F | Performance Guarantee & Performance Test Protocol | Engineering / PM |
| G | Form of Change Order | Attorney |
| H | Seller's Standard Warranty | Attorney / Engineering |
| I | Installation & Pre-Commissioning Requirements | Engineering |
| J | Form of Notice of Commissioning Readiness | Attorney |
| K | Form of Certificate of Completion | Attorney |
| L | Form of Lien Waiver — Conditional | Attorney |
| M | Form of Lien Waiver — Unconditional | Attorney |
| N | Insurance Requirements & Schedule | CFO / Insurance Broker |
| O | Mill Standards — Electrical | Electrical Engineering |
| P | Mill Standards — Mechanical | Mechanical Engineering |
| Q | Mill Standards — Controls | Controls Engineering |
| R | Mill Standards — Surface Coatings | Engineering |

---

## Order of Precedence (within the agreement)
1. Executed Change Orders (most recent governs)
2. Cover Sheet — Project Particulars
3. Terms & Conditions (Articles 1–22)
4. Annexes (A through R, in order — earlier letter governs in conflict)

**Note:** Milestone Payment Summary on Cover Sheet is for reference only. Annex E is the operative payment schedule and governs in all cases of conflict with the Cover Sheet summary.

---

## Browser Compatibility

| Browser | Read (fetch) | Write (File System Access API) | Recommended |
|---|---|---|---|
| Chrome | ✓ | ✓ | Yes |
| Edge | ✓ | ✓ | Yes |
| Firefox | ✓ | ✗ (no File System Access API) | Read-only mode |
| Safari | ✓ | Partial | Not recommended |

**Minimum:** Chrome or Edge for full read/write. Firefox works for viewing and assembling; saving requires download-and-replace workflow.

---

## Future Integration Point

**TSI Intel (Cloudflare D1/R2/Workers):**
At the "Contract Negotiation" stage in the TSI Intel opportunity pipeline, a link opens Contract Studio with a URL parameter pre-populating project fields from the opportunity record. No deeper integration initially — data flows one way (Intel → Studio) at project creation via URL params or a JSON handoff file.

Example URL:
```
http://localhost:8080/assembly.html?project=new&buyer=Berneck+SA&site=Aracuaria&price=1815850
```

---

## Build Sequence

1. Folder structure — create in Explorer, verify OneDrive sync
2. `studio/index.html` — app shell, navigation, TSI house style
3. `config/stub-registry.json` + `config/doc-library-registry.json` — seed with all items
4. `studio/assembly.html` — Module 1, cover sheet only (project create + field population)
5. Three seed stubs — `ip-license`, `indemnification`, `limitation-of-liability`
6. `studio/stubs.html` — Module 2, stub manager with diff view
7. Full T&C article structure in master template
8. Document library — 5 seed forms
9. `studio/tracker.html` — Module 3, review tracker
10. Export — Module 4, clean view + print CSS
11. Remaining stubs + document library items
12. Defined terms engine
13. Calculated fields (LD dollar amounts at contract price)

---

## Key Decisions Still Open

- Arbitration vs. litigation in dispute resolution stub — keep as drafting note toggle in template
- Governing law: Washington default vs. project state — cover sheet drafting note
- Spare parts list: not an annex; procured late in project; referenced in Article 11 only
- O&M Manuals: delivery requirement in Article 2; not a separate annex
- Performance test repeat rights: 2x allowed; upstream/downstream equipment failure carve-out to be drafted in Article 6
- File System Access API write UX: evaluate friction in practice; fall back to download-and-replace if needed

---

## Setup Instructions (First Time)

1. Create folder: `TSI-Contract-Studio/` in your OneDrive-synced SharePoint location
2. Create subfolders per the structure above
3. Clone or copy the `studio/` app files into `studio/`
4. Seed `config/stub-registry.json` and `config/doc-library-registry.json`
5. Open terminal in `studio/`: `python -m http.server 8080`
6. Open browser: `http://localhost:8080`
7. Bookmark it

---

*Internal document — TSI use only — v0.2*
