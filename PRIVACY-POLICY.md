# Privacy Policy

**Last Updated: 2026-10-27**

## Our Commitment to Privacy

At Claret.Tech, we believe in complete transparency and respect for your privacy. This website is designed with a privacy-first approach.

> **🔒 No tracking, no ads, no cookies. This site stores no personal data about you; what leaves your browser is listed below.**

## What We Don't Collect

- ❌ No personal identification information
- ❌ No IP address logging by this site's code (see Hosting)
- ❌ No behavioral tracking
- ❌ No cookies
- ❌ No session recording
- ❌ No fingerprinting
- ❌ No marketing or advertising
- ❌ No social media tracking
- ❌ No cross-site tracking

## Cookies and Local Storage

This site sets no cookies. A few settings stay in your browser's storage and are never sent anywhere: your theme and high contrast choice, the dismissed privacy notice, the terminal window's size and position, and the display quality this browser settled on. If you start the AI assistant, its downloaded model is cached there too.

## Privacy-Preserving Analytics

This site counts visits with Vercel Web Analytics. It uses no cookies, and it recognizes a visit by a hash of the request that Vercel discards after 24 hours, so visitors cannot be followed across sites or days. For each page view it records the page and its route, the referring page, your country and city, and your operating system, browser and device type, with no identifier. We see only totals. Vercel designed it to align with data protection guidance ([Vercel's analytics privacy page](https://vercel.com/docs/analytics/privacy-policy)).

## Hosting

The site runs on Vercel's free Hobby plan. Like any web host, Vercel records each request: the address requested, your IP address and your browser. The site's API runs in Vercel's Washington, D.C. region (United States); pages and files come from the Vercel location nearest you. On this plan, the request logs Vercel shows us are kept for one hour, and its firewall shows up to the last 24 hours of traffic by IP address and by browser. [Vercel's privacy notice](https://vercel.com/legal/privacy-policy) names no fixed period for how long Vercel itself keeps such records. This site's own code logs no IP addresses. To limit abuse, its API keeps your IP address and browser name in memory for a few minutes.

## Error Reports

If a page fails with an error, your browser sends this site the error's type and message (with any quoted value in it blanked), where it happened in the site's code, the page's path (without any query) and the version of the site it ran, with no cookie and no page address. The site publishes the type, the first 300 characters of the message, the code location and the kind of page (such as the homepage or a PDF page) as an issue in its public GitHub repository, so I can fix the error. Nothing about you is published with a report.

## Performance Reports

If you run the terminal's performance report, your browser sends this site the page's address (without any query), your browser and platform, screen size, CPU cores, memory and network type, and the measured timings, to build the report. Nothing is stored.

## External Services

This website fetches public data from these services to display content:

- **GitHub API** - For displaying public repositories and contributions, and for publishing error reports
- **Semantic Scholar API** - For academic publications
- **Crossref** - For publication details, looked up by DOI
- **ORCID** - For research publications
- **Medium** - For blog post previews, its feed read directly from medium.com
- **Hugging Face CDN** - For downloading AI language models used in the terminal assistant
- **Vercel** - For hosting and privacy-preserving analytics

This site's server makes the GitHub, Semantic Scholar, ORCID, Crossref and Medium requests, and fetches and resizes Medium's images; your browser never contacts them. Your browser contacts other sites only if you start the terminal's AI assistant: it downloads the model from Hugging Face and the model's WebGPU library from GitHub (raw.githubusercontent.com). Like any server, they see your IP address and browser; this site sends them nothing else. The models then run entirely in your browser using WebGPU: no data is sent to external servers for AI processing.

## AI Assistant Privacy

The terminal includes an optional AI assistant powered by WebLLM that runs entirely in your browser:

- **Local Processing:** All AI processing happens on your device using WebGPU
- **No Data Transmission:** Your conversations with the AI never leave your browser
- **Model Downloads:** AI models (Llama, Qwen, Phi, Gemma, TinyLlama, RedPajama) are downloaded from Hugging Face only when you explicitly initialize the AI
- **Downloads:** Hugging Face and GitHub see your IP address and browser, as any server does, and nothing else from this site
- **Opt-in Only:** The AI assistant only activates when you run the 'ai init' command

Available models include Llama 3.2 (1B/3B), Phi 3.5 Mini, Gemma 2 2B, Qwen 2.5 1.5B, TinyLlama 1.1B, and RedPajama 3B. Models range from about 0.6 to 2.2 GB and are cached locally after first download.

## Your Rights

This site stores no personal data about you, so there is usually nothing to request or delete. For any question or request, including about the services above, write to privacy@claret.tech.

## Open Source Transparency

This website is open source. You can verify our privacy practices by reviewing the code:

**[View Source Code on GitHub →](https://github.com/RomainClaret/claret.tech)**

Note: The Content Security Policy lets your browser connect to this site and, beyond it, only to huggingface.co, www.huggingface.co, cdn.huggingface.co, cdn-lfs.huggingface.co, cdn-lfs-us-1.huggingface.co, cdn-lfs-eu-1.huggingface.co and \*.hf.co (Hugging Face, for the AI assistant's models), raw.githubusercontent.com (the models' WebGPU library), and vercel.live and ws-us3.pusher.com (Vercel's toolbar on preview deployments).

## Contact

If you have any questions about this privacy policy, please contact:

**Email:** [privacy@claret.tech](mailto:privacy@claret.tech)

## Changes to This Policy

Any changes to this privacy policy will be posted on this page with an updated revision date. Our commitment to not tracking you will never change.
