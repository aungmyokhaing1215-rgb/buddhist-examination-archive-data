# Buddhist Examination Archive

A React + Vite archive frontend with Vercel serverless APIs. GitHub-hosted JSON is the permanent source of truth; no database or persistent Vercel filesystem is used.

## Architecture and data flow

The browser loads the public catalog and published exam content through `/api/public/*`. Admin requests go to `/api/admin/*`; the API verifies a signed, HTTP-only session, validates the payload, and reads/writes JSON via the GitHub Contents API. The GitHub token and session secret exist only in server environment variables. Content is partitioned into JSON files by class/year/subject, keeping reads and commits bounded as the archive grows. Draft and published records are separate in the index; public routes return only published entries.

Typical write path: CKEditor form → authenticated admin API → schema validation → GitHub JSON commit → updated index/catalog → public API. GitHub Contents API SHA checks prevent silently overwriting concurrent edits.

## Structure

```text
api/
  _lib/             GitHub storage, auth, schemas, response helpers
  admin/            Login/session, subjects, exams, publish, import/export
  public/           Catalog, exam detail, search
data/               Structural seed catalog; question content is not fabricated
src/
  app/               Router and app bootstrap
  components/        Shared responsive UI
  layouts/           Public and admin shells
  pages/public/      Home, class, year, subject, exam
  pages/admin/       Dashboard and content management
  services/          HTTP API client
  hooks/ utils/      Reusable state and helpers
```

## Local setup

1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and configure server-only secrets and the GitHub data repository.
3. Run `npm run dev` for the frontend. Vercel Functions run locally with `vercel dev` after installing the Vercel CLI.
4. Deploy through Vercel's Git integration and configure the same environment variables in the project settings.

## Data format

`data/catalog.json` contains classes, subjects, years, and exam metadata only. Exam documents live at `data/exams/{classSlug}/{year}/{subjectId}.json`. An exam document contains `status`, `updatedAt`, and an `items` array of `{ id, questionHtml, answerHtml, order }`. Empty catalog data is intentional until an administrator adds source material.

## Dependencies

Runtime: React, React DOM, React Router, Axios, CKEditor 5 React + Classic build, Zod, jose, cookie, Lucide React. Build: Vite, React plugin, Tailwind CSS v4 and its Vite plugin.

## Security notes

Set a unique high-entropy `SESSION_SECRET`; keep all secrets out of `VITE_*` variables. Use a fine-grained GitHub token restricted to the data repository's contents. Configure HTTPS in production. For multiple admin users, replace the single environment password with an identity provider before opening access.
