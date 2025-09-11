# Privacy Policy

**Last Updated: 2025-09-03**

## Our Commitment to Privacy

At Claret.Tech, we believe in complete transparency and respect for your privacy. This website is designed with a privacy-first approach.

> **🔒 We DO NOT track you. We DO NOT collect personal data. We use only privacy-focused analytics that cannot identify you.**

## What We Don't Collect

- ❌ No personal identification information
- ❌ No IP address logging
- ❌ No behavioral tracking
- ❌ No tracking cookies
- ❌ No session recording
- ❌ No fingerprinting
- ❌ No marketing or advertising
- ❌ No social media tracking
- ❌ No cross-site tracking

## Functional Cookies Only

We use only essential, functional cookies that are necessary for the website to work properly:

- **Theme Preference:** Remembers if you prefer dark or light mode (stored locally)
- **Safari Detection:** Helps optimize performance for Safari browsers (session only)

These cookies contain no personal information and are not shared with any third parties.

## Privacy-Preserving Analytics

This website uses Vercel Web Analytics - a privacy-first analytics service that:

- Does not use cookies or any client-side state
- Does not track individual users across websites
- Does not collect personal information
- Uses anonymized hashed request data that resets daily
- Is fully GDPR and CCPA compliant
- Provides only aggregate, anonymous metrics

Vercel identifies visits through a hash created from incoming requests instead of using cookies. This ensures visitors cannot be tracked across different websites, and the hash is reset daily for maximum privacy. These analytics help us understand site performance and improve the website experience while maintaining your complete privacy.

## External Services

This website fetches public data from these services to display content:

- **GitHub API** - For displaying public repositories and contributions
- **Semantic Scholar API** - For academic publications
- **ORCID** - For research publications
- **Medium** - For blog post previews
- **Hugging Face CDN** - For downloading AI language models used in the terminal assistant
- **Vercel** - For hosting and privacy-preserving analytics

For GitHub, Semantic Scholar, ORCID, and Medium, these are server-side requests only. The AI models are downloaded directly to your browser from Hugging Face's CDN when you initialize the terminal AI assistant. These models run entirely in your browser using WebGPU - no data is sent to external servers for AI processing.

## AI Assistant Privacy

The terminal includes an optional AI assistant powered by WebLLM that runs entirely in your browser:

- **Local Processing:** All AI processing happens on your device using WebGPU
- **No Data Transmission:** Your conversations with the AI never leave your browser
- **Model Downloads:** AI models (Llama, Qwen, Phi, Gemma, TinyLlama, RedPajama) are downloaded from Hugging Face CDN only when you explicitly initialize the AI
- **No Tracking:** Model downloads are anonymous - Hugging Face cannot identify you
- **Opt-in Only:** The AI assistant only activates when you run the 'ai init' command

Available models include Llama 3.2 (1B/3B), Phi 3.5 Mini, Gemma 2 2B, Qwen 2.5 1.5B, TinyLlama 1.1B, and RedPajama 3B. Models range from 0.5GB to 2GB in size and are cached locally after first download.

## Your Rights

Since we don't collect personal data, there's nothing to request, delete, or opt-out from. You automatically have:

- ✅ Complete privacy by default
- ✅ No data to be deleted
- ✅ No tracking to opt-out from
- ✅ No personal information stored

## Open Source Transparency

This website is open source. You can verify our privacy practices by reviewing the code:

**[View Source Code on GitHub →](https://github.com/RomainClaret/claret.tech)**

Note: The Content Security Policy allows connections to Hugging Face CDN domains (cdn.huggingface.co, cdn-lfs.huggingface.co, and regional variants) specifically for downloading AI models when you use the terminal AI assistant.

## Contact

If you have any questions about this privacy policy, please contact:

**Email:** [privacy@claret.tech](mailto:privacy@claret.tech)

## Changes to This Policy

Any changes to this privacy policy will be posted on this page with an updated revision date. Our commitment to not tracking you will never change.
