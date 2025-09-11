# GitHub Actions CI/CD

This directory contains the CI/CD workflows for the claret.tech v2 project.

## Workflows

### 1. CI Workflow (`ci.yml`)

Runs on all pushes and pull requests to ensure code quality.

**Jobs:**

- **Lint**: Checks code style with ESLint
- **Type Check**: Validates TypeScript types
- **Format**: Ensures consistent code formatting with Prettier
- **Test**: Runs unit tests with Vitest
- **Build**: Verifies the Next.js build succeeds

### 2. Deploy Workflow (`deploy.yml`) - MANUAL ONLY

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

**Note**: Vercel's automatic GitHub deployments are disabled in vercel.json

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

**Required:**

- `VERCEL_TOKEN`: Your Vercel personal access token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

**Production Deployment:**

- `GH_TOKEN`: GitHub personal access token for API access
- `GH_USERNAME`: Your GitHub username
- `MEDIUM_USERNAME`: Your Medium username

**Optional:**

- `NEXT_PUBLIC_GA_ID`: Google Analytics ID
- `NEXT_PUBLIC_SENTRY_DSN`: Sentry error tracking DSN

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

4. Test workflows locally:

   ```bash
   # Test CI workflow
   act push -j lint
   act push -j test
   act push -j build

   # Test all CI jobs
   act push -W .github/workflows/ci.yml

   # Test deployment (dry run)
   act push -W .github/workflows/deploy.yml --dryrun

   # Test with pull request event
   act pull_request
   ```

## Workflow Triggers

- **CI**: Runs on all pushes and pull requests
- **Deploy**: Manual trigger only from GitHub Actions tab (workflow_dispatch)
- **Playwright**: Runs on all pushes and pull requests

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
