# 🧬 Claret.tech: Evolving Artificial Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org)
[![CI](https://github.com/RomainClaret/claret.tech/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RomainClaret/claret.tech/actions/workflows/ci.yml)
[![Playwright Tests](https://github.com/RomainClaret/claret.tech/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/RomainClaret/claret.tech/actions/workflows/playwright.yml)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-green?logo=vercel)](https://claret.tech)

> **Neuroevolution researcher and lecturer breeding neural networks that assemble solutions from evolved components.**

## ✨ Features

- **Dual Brain Animation** - Two neural networks drawn on 2D canvases, with signal particles
- **Interactive Terminal** - Full xterm.js integration with WebLLM AI chat
- **Privacy-First Design** - No ads or third-party cookies, privacy-focused Vercel Analytics, local-only AI processing
- **Adaptive Performance** - Optimized for all browsers including Safari
- **Research Portfolio** - Publications, projects, and algorithm details

## 🚀 Quick Start

```bash
# Node.js 24, the major CI runs (.nvmrc), then the dependencies
npm ci

# Development server
npm run dev              # HTTP development server
npm run dev:https        # HTTPS development server (for testing HTTPS features)
```

**Note:** The HTTPS development server automatically generates self-signed certificates using mkcert. This is useful for testing:

- Secure contexts (Service Workers, WebRTC, etc.)
- HTTPS-only features and security headers
- Webhook integrations that require SSL

The server will be available at `https://localhost:3000` with an automatically trusted local certificate.

```bash
# Production build
npm run build
npm start
```

### Environment Variables

Create a `.env.local` file:

```env
GITHUB_TOKEN=your_github_token
GH_USERNAME=your_username
USE_GITHUB_DATA=true
```

`.env.example` lists every variable the code reads, with its default.

## 🏗️ Tech Stack

- **Framework**: Next.js 16 with App Router, React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Animation**: Framer Motion
- **AI**: WebLLM
- **Terminal**: xterm.js
- **Testing**: Vitest + Playwright

## 🧪 Testing

- **Unit Tests**: components, hooks, utilities and API routes (Vitest, jsdom)
- **E2E Tests**: the built site in Chromium, Firefox and WebKit, desktop and phone (Playwright)

```bash
# Unit tests, in watch mode
npm test

# The unit suites, in batches as CI runs them
npm run test:ci

# E2E tests, against a dev server on port 3000 (started if none runs)
npm run test:e2e

# or against a production build, as CI does
SERVE_HTTP=true npm run build && SERVE_HTTP=true npx next start -p 3001 -H 127.0.0.1
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

**Note**: CI runs `test:ci`, the four component batches (`test:components:batch1` to `batch4`), `test:hooks` and `test:utils`. `src/app/ci-test-lists.test.ts` fails when a test file is in none of them, and `src/app/ci-workflows.test.ts` fails when no Playwright job runs a spec.

## 📦 Deployment

Production deploys run from the **Deploy to Vercel** workflow (GitHub Actions, started by hand). It runs CI first, then builds on the runner with `vercel build --prod` and uploads the result. The Vercel project has no Git connection (removed 2026-10-27) and `vercel.json` turns Git deployments off by both of its keys, so a push or a pull request deploys nothing by itself.

## 📄 License

This project is open source under the [GPL-3.0-or-later](LICENSE) license. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[🌐 Live](https://claret.tech)** • **[📧 Contact](mailto:claret.tech.website.pessimist917@simplelogin.com)**

_"Trained networks memorize. Evolved networks adapt. 🐧"_

</div>
