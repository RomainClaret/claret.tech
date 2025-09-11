# 🧬 Claret.tech — Evolving Artificial Intelligence

[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-100%25-brightgreen)](https://github.com/RomainClaret/claret.tech)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-green?logo=vercel)](https://claret.tech)

> **PhD researcher breeding neural networks that think in components, not patterns.**  
> Evolution spent billions of years creating intelligence. I'm compressing that into days.

## ✨ Features

- **Dual Brain Animation** - WebGL-powered neural visualization with particles
- **Interactive Terminal** - Full xterm.js integration with WebLLM AI chat
- **Privacy-First Design** - Zero tracking, no analytics, local-only AI processing
- **Adaptive Performance** - Optimized for all browsers including Safari
- **Research Portfolio** - Publications, projects, and algorithm details

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev              # HTTP development server
npm run dev:https        # HTTPS development server (for testing HTTPS features)
```

**Note:** The HTTPS development server automatically generates self-signed certificates using mkcert. This is useful for testing:

- Secure contexts (Service Workers, WebRTC, etc.)
- HTTPS-only features and security headers
- Webhook integrations that require SSL

The server will be available at `https://localhost:3000` with an automatically trusted local certificate.

# Production build

npm run build
npm start

````

### Environment Variables

Create a `.env.local` file:

```env
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_username
````

## 🏗️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **AI**: WebLLM
- **Terminal**: xterm.js
- **Testing**: Vitest + Playwright

## 🧪 Testing

The project uses a dual testing strategy:

- **Unit Tests**: Business logic, utilities, and API routes (Vitest)
- **E2E Tests**: Full DOM and user interaction testing (Playwright)

```bash
# Run all tests locally (includes DOM tests)
npm test

# Run CI-compatible tests (excludes DOM tests)
npm run test:ci

# Run only DOM tests for debugging
npm run test:dom-only

# Run E2E tests
npm run test:e2e
```

**Note**: CI runs `test:ci` which excludes `.tsx` test files due to jsdom limitations in CI environments. DOM functionality is comprehensively tested through 355+ Playwright E2E tests.

## 📦 Deployment

Optimized for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

## 📄 License

This project is open source under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[🌐 View Live](https://claret.tech)** • **[📧 Contact](mailto:claret.tech.website.pessimist917@simplelogin.com)** • **[🐦 Twitter](https://twitter.com/RomainClaret)**

_"Intelligence isn't trained—it evolves."_

</div>
