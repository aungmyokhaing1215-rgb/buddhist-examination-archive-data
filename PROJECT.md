# Buddhist Examination Archive — Project Guide

## Purpose and current state

A responsive React website for browsing and searching manually entered Buddhist examination questions and answers. Examination content is JSON only. GitHub is the permanent source of truth; the Vercel filesystem is not used for persistent writes. No database, PDF, OCR, or fabricated examination content is included.

The repository currently contains the five required class records, but `public/data/subjects.json` and `public/data/index.json` are empty and there are no examination records. Consequently, the public application currently has no real exams to display or search. Admin data editing and publishing require valid server environment configuration and a GitHub repository.

## Architecture

- **Client:** React 18, Vite, JavaScript, React Router, Tailwind CSS v4, Axios, CKEditor 5 Classic, DOMPurify, Lucide icons.
- **Server:** Vercel serverless functions in `api/`; Node.js crypto and `jose` implement password verification and signed sessions.
- **Storage:** GitHub REST API. Catalog and published data live in the configured data root (default `public/data`); drafts live in the repository-root `drafts/` folder.
- **Deployment:** Vercel builds the Vite site and deploys API handlers. A publish writes JSON commits to the configured GitHub branch, which can trigger the connected Vercel deployment.
- **No database:** JSON files are the only archive storage format.

### Data flow

1. Public React pages call read-only `/api/public/*` handlers. In Vite-only development, the frontend falls back to JSON files in `public/data`.
2. An administrator signs in through `/api/admin/login`. A signed, HTTP-only cookie identifies the session; state-changing requests also require its CSRF token and same-origin checks.
3. Admin changes are validated in the serverless handler and committed to GitHub using the repository Contents API (and Git Trees API for large JSON writes). The browser never receives the GitHub token.
4. Draft examinations are stored under `drafts/{classSlug}/{year}/{subjectSlug}.json`. Publishing validates the saved examination, writes `public/data/exams/{classSlug}/{year}/{subjectSlug}.json`, regenerates `public/data/index.json`, and reports success only after GitHub confirms both commits.
5. Public search queries the generated index. That index stores searchable plain question and answer text, question identifiers, and section metadata; the full exam JSON retains CKEditor HTML.

## Repository structure

```text
api/
  _lib/                 Auth, GitHub JSON access, validation/indexing, HTTP helpers
  admin/                Login/session, dashboard, catalog, exam, search, import/export, publish APIs
  public/               Catalog, examination, index and search APIs
public/
  data/
    classes.json        Five required class records
    subjects.json       Class-assigned subject records (currently empty)
    index.json          Published exam search metadata (currently empty)
    exams/              Published exam JSON files by class/year/subject
src/
  app/                  React Router configuration and lazy route loading
  components/           Shared public components
  layouts/              Public site layout
  pages/public/         Home, browse, exam, search, about, not found
  pages/admin/          Admin dashboard and manual CKEditor examination editor
  services/             Frontend API client and Vite static-data fallback
  *.css                 Global and page/admin styling
scripts/                Admin password hash utility
tests/                  Node built-in tests
```

Other root configuration includes `vite.config.js`, `vercel.json`, `.env.example`, `package.json`, and `package-lock.json`. The project does not currently have dedicated hooks, utilities, or validation directories; server validation is in `api/_lib/data.js`.

## JSON data contract

### Catalog files

`public/data/classes.json` contains class objects with `id`, `name`, `slug`, `order`, and `status`. It is seeded with `primary` (မူလတန်း), `first-level` (ပထမယ်တန်း), `first-middle` (ပထမလတ်တန်း), `first-high` (ပထမကြီးတန်း), and `dhammacariya` (ဓမ္မစရိယတန်း).

`public/data/subjects.json` contains subject objects with `id`, `classId`, `name`, `slug`, `order`, and `status`. Subject IDs are unique; a class/slug pair is unique. Subjects are currently empty and are created through the admin catalog UI.

### Examination files

Published path: `public/data/exams/{classSlug}/{year}/{subjectSlug}.json`.

Draft path in the GitHub repository: `drafts/{classSlug}/{year}/{subjectSlug}.json`.

An examination has `id`, `classId`, `year`, `subjectId`, `subjectName`, `title`, calculated `totalMarks`, ordered `sections`, `status`, `createdAt`, and `updatedAt`. Each section has a unique `id`, `title`, positive `order`, calculated `marks`, and `questions`. Each question has a unique `id`, positive integer `number` and `order`, supported `type`, HTML-string `question` and `answer`, and nonnegative numeric `marks`. Additional fields (such as `keywords` and question-type-specific options) are retained.

Supported question types: `short_answer`, `long_answer`, `multiple_choice`, `fill_blank`, `true_false`, `matching`, `essay`, `translation`, and `other`.

Server validation checks the selected class/subject/year, status, required title and sections, unique IDs, question numbers within each section, question type, marks, and nonempty HTML content. Years are limited to 2000–2026. It calculates each section's marks from its questions and the exam total from sections. Question and answer HTML is sanitized with DOMPurify before public/preview rendering.

### Search index

`public/data/index.json` is an array of published-exam entries. Each entry includes exam/class/year/subject/title/path metadata and section/question metadata, including question ID/number/type, keywords, and plain searchable question and answer text. Publishing regenerates the entry from the validated exam JSON. Searches normalize text to Unicode NFC and lowercase it; query terms and class/year/subject filters can be combined. Public search is paginated (up to 50 results per page); admin search also includes drafts and permits status, title, question number and type filters.

## Application routes and features

### Public routes

- `/` — introduction, class links, years and recent/indexed archive information, global search entry.
- `/browse`, `/browse/:classSlug`, `/browse/:classSlug/:year`, `/browse/:classSlug/:year/:subjectId` — class/year/subject browsing.
- `/exam/:classSlug/:year/:subjectId` — examination detail, section navigation, questions ordered by number, answers directly below each question, marks, sanitized formatting, and print support.
- `/search` — combined class/year/subject/text search with pagination and direct links to matching questions.
- `/about` and a not-found page.

The homepage can show the configured year range even if empty. Class year selection is based on published index entries; no actual records currently exist.

### Admin route

- `/admin/*` — login and dashboard interface, catalog/class/subject management, examination/question/section editing, admin search, JSON backup/restore and publishing tools.
- Question and answer fields use separate CKEditor 5 Classic editor instances. The configured toolbar includes headings, bold, italic, lists, tables, undo and redo; a symbol strip inserts common math and Pali characters. The editor is loaded only for admin editing. The project does not claim the Classic build provides a dedicated special-character plugin.
- Questions can be manually entered, reordered and moved between sections. Preview displays questions, answers, marks, sections and calculated total together; there is no reveal-answer interaction.

## API reference

All endpoints are Vercel serverless functions. Unless stated otherwise, JSON errors include an `error` message. Every admin endpoint requires an authenticated session; mutations additionally require CSRF validation, except login and the read-only validation preview.

| Method and path | Purpose |
| --- | --- |
| `GET /api/public/catalog` | Active classes, their active subjects, and supported years |
| `GET /api/public/index` | Published search index |
| `GET /api/public/search` | Published search; accepts `query`, `classSlug`, `year`, `subjectId`, `page`, `pageSize` |
| `GET /api/public/exam` | Published exam by `classSlug`, `year`, `subjectId` query parameters |
| `POST /api/admin/login` | Verify username/password, issue session cookie and CSRF token |
| `POST /api/admin/logout` | Clear session cookie |
| `GET /api/admin/session` | Current auth state and CSRF token when authenticated |
| `GET /api/admin/catalog` | Read classes and subjects |
| `PUT /api/admin/catalog` | Add/edit/reorder/toggle/delete classes (required five cannot be deleted) |
| `PUT /api/admin/subject` | Add/edit/reorder/toggle/delete a class subject |
| `GET /api/admin/dashboard` | Counts and recently updated records |
| `GET /api/admin/search` | Search published records and drafts with combined admin filters |
| `GET /api/admin/exam` | Load a draft or published exam by class/year/subject |
| `PUT /api/admin/exam` | Validate and save a draft to GitHub |
| `DELETE /api/admin/exam` | Remove the selected published exam and/or draft |
| `POST /api/admin/publish` | Validate, commit published exam and regenerated index |
| `GET /api/admin/export` | Download a JSON backup (`schemaVersion: 2`) |
| `POST /api/admin/validate` | Validate an imported backup and return a summary |
| `POST /api/admin/import` | Restore backup JSON to GitHub and regenerate index |

There is no direct GitHub API endpoint exposed to the browser; GitHub REST calls are server-side helpers.

## Security and configuration

Set the following in local `.env.local` and Vercel server environment settings. Never commit secret values or prefix them with `VITE_`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | Yes | Server-only token with repository content read/write access |
| `GITHUB_OWNER` | Yes | GitHub owner or organization |
| `GITHUB_REPO` | Yes | Repository name |
| `GITHUB_BRANCH` | No | Storage branch; defaults to `main` |
| `GITHUB_DATA_PATH` | No | Storage root; defaults to `public/data` |
| `ADMIN_USERNAME` | Yes for login | Admin account name |
| `ADMIN_PASSWORD_HASH` | Yes for login | `scrypt$<salt hex>$<digest hex>` password hash |
| `SESSION_SECRET` | Yes for sessions | At least 32 characters, used to sign HS256 sessions |
| `NODE_ENV` | Platform | Production controls the Secure cookie flag |
| `VITE_CKEDITOR_LICENSE_KEY` | No | Public build-time CKEditor license key; defaults to `GPL` |

Sessions last eight hours and use the `archive_session` HttpOnly, SameSite Strict cookie (Secure in production). Mutations check the session CSRF token, request origin/host, and Fetch Metadata. Login throttling permits five failed attempts in a 15-minute window per warm function instance; it is not a globally shared limit. GitHub writes use file SHAs and expected current tree state to detect conflicts. Paths are constrained to known JSON layouts.

Create a password hash with `node scripts/hash-admin-password.mjs` in an interactive terminal, then put the generated hash in the server environment. The script prompts for the password; do not include passwords in shell command arguments or source files.

CKEditor 5 v44 is dual licensed. Default `GPL` mode is appropriate only if distribution complies with GPL 2.0 or later. For a project that cannot meet GPL terms, configure an appropriate commercial license key. Review [CKEditor licensing and activation](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html) before production use.

## Install, develop, test, build

Prerequisites: Node.js 20 or newer and npm. The repository does not pin an exact Node version.

```sh
npm install
```

For frontend-only development:

```sh
npm run dev
```

Vite-only mode serves the React site but does not run Vercel serverless API functions; the frontend uses static JSON fallbacks where available. To exercise `/api/*` handlers locally, install/use the Vercel CLI, configure `.env.local`, link the project if required, and run `vercel dev`.

Available package scripts:

```sh
npm test          # Node built-in test suite
npm run build     # Production Vite build into dist/
npm run preview   # Serve the production build locally
```

Tests use structural/synthetic fixtures only; no mock questions are stored as archive content.

## Vercel deployment

1. Push the project to GitHub and import that repository into Vercel.
2. Use the Vite build command `npm run build` and output directory `dist` (or the detected Vite preset).
3. Add the required server variables above to Vercel for Preview and Production as appropriate. Add the optional CKEditor key only as a build variable if required by the selected license.
4. Ensure the Vercel integration watches the same branch configured by `GITHUB_BRANCH` so committed archive changes trigger deployment.
5. Verify API routes and SPA deep links on a Preview deployment before directing users to Production.

`vercel.json` sets the serverless function max duration to 30 seconds and rewrites SPA paths to `/index.html`. See [Vercel rewrites](https://vercel.com/docs/routing/rewrites) and [function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Backup, restore and operational limitations

Export includes `schemaVersion`, catalog, index, published exam JSON and drafts. Restore validates input, writes files through GitHub and regenerates the index. Each GitHub file write/delete is a separate commit; restore is not atomic and a later failure can leave a partially restored repository. Keep a fresh export before restore and review the resulting GitHub commits.

Current known limitations:

- There are no subjects or real examinations in the checked-in JSON yet.
- GitHub-dependent admin actions require the environment variables and repository permissions; they cannot be fully exercised in frontend-only Vite mode.
- The in-memory login throttle is instance-local.
- Public and admin search scan the JSON index (and drafts for admin search). It is designed for thousands of questions; substantially larger collections may require index sharding while retaining JSON/GitHub storage.
- Import/restore and publishing involve multiple GitHub commits and can be partially applied if a later request fails. Publishing reports partial status when exam commit succeeds but index confirmation fails.
- CKEditor is a relatively large editor asset but is loaded on demand in the admin editor.

