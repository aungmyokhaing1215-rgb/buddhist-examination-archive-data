# Changelog

Project history is maintained from the implementation currently present in the repository. Earlier dated release notes were not available during this documentation update; entries below describe the current feature set without assigning unsupported release dates.

## Current implementation

- Added a React/Vite public archive with class/year/subject browsing, examination display, global indexed search, About and not-found pages, and print styling.
- Added the five required class records and JSON catalog/index/examination path conventions. No actual subjects or examinations are seeded.
- Added manual examination, section, question, and answer entry using separate CKEditor 5 Classic instances. Examination content is stored as HTML strings in JSON.
- Added server-side validation, derived section/examination marks, question-type support, and DOMPurify rendering sanitization.
- Added Vercel serverless APIs for public archive reads and protected admin login/session, catalog, dashboard, search, exam editing, publishing, validation, export, and restore.
- Added GitHub REST-backed JSON reads and commits, SHA conflict handling, published search-index regeneration, draft storage, and backup/restore.
- Added responsive styling, route-level lazy loading, structural tests, Vercel configuration, and project documentation.

## Current constraints

- The class catalog is populated, while subjects and published examinations are empty until an administrator enters real records.
- Vercel API behavior and GitHub publishing require valid server environment configuration and repository access.
- Backup restore consists of multiple GitHub commits and is not atomic.
- Login throttling is kept in memory per warm serverless instance.
