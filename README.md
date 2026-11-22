# Buddhist Examination Archive

Responsive React/Vite archive with Vercel serverless APIs. JSON files in the configured GitHub repository are the only persistent storage; no database or Vercel filesystem persistence is used. The default GitHub data root is `public/data`.

## JSON layout

```text
public/data/
  classes.json       Five structural class records
  subjects.json      Class-assigned subject records
  index.json         Search metadata for published exams and questions
  exams/{classSlug}/{year}/{subjectSlug}.json
drafts/{classSlug}/{year}/{subjectSlug}.json  (GitHub root; unpublished admin revisions)
```

Exam documents use the section/question schema in the project request. Supported question types: `short_answer`, `long_answer`, `multiple_choice`, `fill_blank`, `true_false`, `matching`, `essay`, `translation`, and `other`. Extra type-specific question properties are preserved.

## Validation and publishing

Admin saves validate class, subject and year (2000–2026), required exam/section/question fields, unique section/question IDs, unique positive question numbers within each section, supported question type, and nonnegative marks. On every save, question marks are summed into section marks and section marks into examination `totalMarks`. Unpublished drafts are kept at the GitHub repository root under `drafts/` so they are not served as Vite public assets. Publishing writes the published copy to `public/data/exams/...` and regenerates `public/data/index.json`; public APIs and static paths only expose published exam JSON. The index contains class/year/subject/exam metadata, section details, and plain searchable question and answer text.

## Backup and restore

Admin JSON backup downloads classes, subjects, the current index, and all exam JSON documents. Restore validates the class/subject/exam structures, writes the JSON files to GitHub, removes exam files absent from the backup, and rebuilds the search index. GitHub Contents API commits each file separately, so a large restore is a sequence of commits rather than one atomic operation.

## Project structure

```text
api/_lib/             GitHub JSON storage, validation, indexing, authentication
api/public/           Catalog, published exam and indexed search endpoints
api/admin/            Login/session, subject/exam management, publish, backup/restore
public/data/          Structural JSON seed files and Vite-served data paths
src/app/              React Router setup
src/components/       Shared interface
src/layouts/          Public shell
src/pages/public/     Home, browse, examination detail
src/pages/admin/      Admin login, exam editor and subject manager
src/services/         Frontend API client
```

## Setup

1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env.local`. Set `GITHUB_OWNER`, `GITHUB_REPO`, and a fine-grained `GITHUB_TOKEN` with Contents read/write permission. Use a private GitHub repository for the storage target so unpublished JSON drafts are not exposed from the repository. Keep `GITHUB_DATA_PATH=public/data`. Set a strong `ADMIN_PASSWORD` and `SESSION_SECRET` of at least 32 characters.
3. Run `vercel dev` for the Vite app and serverless API together.
4. Deploy through Vercel Git integration and add the same server-only variables in the Vercel project settings.

Runtime dependencies: React, React DOM, React Router, Axios, CKEditor 5, DOMPurify, jose, cookie, and Lucide React. Build dependencies: Vite, React plugin, Tailwind CSS v4 and its Vite plugin.
