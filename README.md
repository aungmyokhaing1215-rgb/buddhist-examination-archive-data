# Buddhist Examination Archive

A responsive React archive for manually entering, publishing, browsing, and searching Buddhist examination questions and answers. JSON files in GitHub are the only permanent data store; the project uses no database and includes no PDF or OCR workflow.

## Project documentation

- [Project guide](PROJECT.md) — architecture, data schema, routes, APIs, security, setup, testing, and deployment.
- [Changelog](CHANGELOG.md) — implementation history and current project state.

## Quick start

Requires Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Vite-only mode serves the frontend. To use serverless APIs locally, configure `.env.local` from `.env.example`, install/use the Vercel CLI, and run `vercel dev`.

```sh
npm test
npm run build
npm run preview
```

The archive currently has the five required classes but no subjects or examination records. Configure the GitHub and admin server environment variables before using admin publishing. See [PROJECT.md](PROJECT.md) for complete instructions.
