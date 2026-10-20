# GitHub Actions CI/CD

This directory contains the CI/CD workflows for the claret.tech v2 project.
Every workflow runs Node 24, the major in `package.json`'s `engines`
(`src/app/ci-workflows.test.ts` checks).

## Workflows

### 1. CI Workflow (`ci.yml`)

Runs on all pushes and pull requests (all branches, including slash-named
ones like `feature/foo`). Superseded runs on the same ref are cancelled
automatically (concurrency group).

**Jobs:**

- **Detect Changes**: path filters decide which test jobs a push needs
  (pull requests always run everything)
- **Quick Checks**: lint (the site and its tests), `format:check` (fails on
  a file Prettier would change), type-check, knip (files, exports and
  dependencies nothing uses; `knip.jsonc`), and actionlint on the workflows
  themselves (`npm run lint:workflows`, Docker)
- **Test jobs**: Vitest split into parallel jobs - API routes, utilities,
  components (4 batches, file lists in `package.json`
  `test:components:batch1..4`), contexts, hooks, library DOM, non-DOM units
- **Build**: verifies the Next.js production build, and that the homepage
  is still a static file (`.github/scripts/check-static-home.mjs`)
- **CI Summary**: aggregates all results

Every unit test file runs in some job: `src/app/ci-test-lists.test.ts` fails
on a file no CI script runs. A new component test goes in one of the four
batches.

### 2. CI under act (`ci-act.yml`)

A copy of the unit jobs for running CI locally with act. It runs only when
dispatched (it ran on every push beside `ci.yml` until 2026-10).

### 3. Playwright (`playwright.yml`)

End-to-end tests against a production build, on pushes and pull requests to
`main` (docs-only changes skipped) and by hand (`force_all_tests` runs every
job). Path filters pick the jobs; any change under `src/`, `public/` or
`scripts/` runs them all (Lighthouse only on pushes, or on a pull request
labelled `performance`). Each job names its spec files, and
`src/app/ci-workflows.test.ts` fails on a spec that no job names.

### 4. Deploy Workflow (`deploy.yml`) - MANUAL ONLY

**Trigger**: Manual dispatch only (no automatic deployments)

**How to Deploy:**

1. Go to GitHub Actions tab
2. Select "Deploy to Vercel" workflow
3. Click "Run workflow" button
4. Choose environment (production/preview)
5. Click green "Run workflow" button

**Jobs:**

- **CI Checks**: Runs all CI workflow checks first
- **Deploy Preview**: Deploys preview builds when "preview" is selected
- **Deploy Production**: Deploys to production when "production" is selected

**Note**: Vercel's automatic GitHub deployments are disabled in vercel.json,
so this workflow is the only way to production.

### 5. Update Publications (`update-publications.yml`)

Manual dispatch only. Runs `scripts/fetch-publications.js` and opens a pull
request with the changes (`docs/publications.md`).

### 6. Client Error Reports (`client-error-notify.yml`)

Runs when an issue is opened or reopened. The error pages file reports as
issues labeled `client-error`, with the owner's token
(`src/app/api/client-error/route.ts`), and GitHub notifies nobody of their
own activity. For the owner's own `client-error` issues only, this workflow,
acting as github-actions with `issues: write`, assigns a new report to the
owner and mentions the owner when one is reopened (its bug is back on the
build serving now), so the owner is notified. It runs `gh` only, and nothing
from an issue's text reaches the shell.

## Setup Instructions

### 1. Vercel Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Get your org and project IDs:
   ```bash
   cat .vercel/project.json
   ```

### 2. GitHub Secrets

Add these secrets to your GitHub repository (Settings > Secrets > Actions):

**Deploy:**

- `VERCEL_TOKEN`: Your Vercel personal access token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID
- `GH_TOKEN`: GitHub token for the builds' API calls (passed as
  `GITHUB_TOKEN`)
- `MEDIUM_USERNAME`: the blog's Medium account, with or without the `@`,
  passed as `NEXT_PUBLIC_MEDIUM_USERNAME`. Unset, the blog reads
  `romainclaret`

The production and preview builds get the same env (one block in
`deploy.yml`, shared by a YAML anchor), so a preview builds what production
would. That block also names `GH_USERNAME` (a public name, so not a
secret): with the token and `USE_GITHUB_DATA` it lets the build save the
pinned repositories at `/profile.json` (`src/app/profile.json/route.ts`),
which Projects reads when `/api/fetch-github` fails. A build without them
prerenders a 404 there.

The build's other variables (the rest of `.env.example`) come from the
Vercel project's environment, which `vercel pull` fetches before the build;
the API routes read `GH_USERNAME` from it at run time.

**Update Publications:**

- `SEMANTIC_SCHOLAR_AUTHOR_ID`, `ORCID_ID`, `AUTHOR_NAME` (default
  "Romain Claret")

### 3. Local Testing with ACT

1. Install ACT:

   ```bash
   brew install act
   # or
   curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   ```

2. Copy the example secrets file:

   ```bash
   cp .env.act.local.example .env.act.local
   ```

3. Fill in your values in `.env.act.local`

4. Run the unit jobs as CI does (`.actrc` sets the Node 24 image):

   ```bash
   act workflow_dispatch -W .github/workflows/ci-act.yml

   # When act's own fetch of the actions times out, use its cached copies
   act workflow_dispatch -W .github/workflows/ci-act.yml --action-offline-mode
   ```

## Workflow Triggers

- **CI**: Runs on all pushes and pull requests (superseded runs cancelled)
- **CI under act**: workflow_dispatch only
- **Playwright**: workflow_dispatch, plus pushes/PRs targeting main
  (docs-only changes skipped); superseded runs cancelled
- **Deploy**: Manual trigger only from GitHub Actions tab (workflow_dispatch)
- **Update Publications**: workflow_dispatch only

## Environment URLs

- **Production**: https://claret.tech
- **Preview**: Dynamically generated Vercel preview URLs

## Troubleshooting

### Build Failures

1. Check that all environment variables are set
2. Ensure `npm ci` completes successfully
3. Verify TypeScript types with `npm run type-check`

### Deployment Issues

1. Verify Vercel tokens and IDs are correct
2. Check Vercel dashboard for deployment logs
3. Ensure GitHub secrets are properly set

### ACT Issues

1. Make sure Docker is running
2. Use `--verbose` flag for detailed output
3. Check `.actrc` configuration
4. Ensure `.env.act.local` has all required values
