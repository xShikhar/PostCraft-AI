// ---------------------------------------------------------------------------
// Legal content
// ---------------------------------------------------------------------------
//
// The canonical source of truth for the legal copy lives in
// `PRIVACY.md` at the repo root (maintained alongside the rest of the
// launch-readiness docs). The content is duplicated here because the
// privacy/terms pages need to render without a backend round-trip — and
// shipping it as a string keeps the page self-contained.
//
// When you change PRIVACY.md, mirror the change here. The two are kept
// in sync manually; they are short enough that the cost of drift is
// lower than the cost of building a loader.
//
// Last reviewed against PRIVACY.md: 2026-09-05.
// ---------------------------------------------------------------------------

export const LAST_UPDATED = "2026-09-05";

// Privacy Policy — sections 1–10 of PRIVACY.md (the heading
// "Privacy Policy" is the first `# ` line).
export const PRIVACY_POLICY_MARKDOWN = `We collect account data (username, password hash, auth tokens), content you provide (resume, draft inputs, generated drafts, style profile, profile context, about me), research data (cached public web search snippets), and service data (cost logs, request metadata).

We use your data to provide the service, maintain and improve it, and monitor costs and abuse. We do not sell your data, share it with advertisers, or use your resume or drafts to train third-party models.

Third-party processors:

- **Google (Gemini API)** — topic, raw thoughts, resume text, profile context, style profile, and research snippets are sent to Google's Gemini API to generate drafts and extract style patterns. Google's API terms govern their use.
- **PostgreSQL (self-hosted)** — your account data and content.
- **ChromaDB (self-hosted)** — your style profile vectors, used for similarity lookup during generation.
- **Sentry (optional)** — error reports from the backend. We do not send PII by default.

**Data retention**

| Data | Retention |
|------|-----------|
| Account | Until you delete your account |
| Resume (raw text + summary) | Until you delete it or your account |
| Generated drafts + history | Until you delete them or your account |
| Style profile | Until you delete it or your account |
| Research cache | 30 days (configurable) |
| Cost logs | Indefinite, used for service cost monitoring |
| Request metadata (IP, UA) | 7 days (for rate limiting and abuse detection) |

When you delete your account, all account-linked data is permanently deleted from our database and vector store within seconds. Cost logs (which reference generation IDs but not your identity) are retained.

**Your rights**

- **Access** — request a copy of your data.
- **Correction** — edit your profile context, about me, and style preferences in the app.
- **Deletion** — delete your account and all associated data from the app settings.
- **Portability** — request a machine-readable export of your data.

If you're in the EU/UK, GDPR also gives you the right to restrict processing, object to processing, and lodge a complaint with your supervisory authority.

**Security.** Resume PII is encrypted at rest using Fernet (AES-128 in CBC mode + HMAC-SHA256). Database connections are encrypted with TLS in production. Authentication tokens are JWTs signed with a server-side secret. Rate limiting is applied to authentication and generation endpoints.

We do not knowingly collect data from children under 16. If you believe a child has created an account, contact us to have it deleted.

If you use the service from outside the country where our servers are located, your data will be transferred across borders. By using the service you consent to this transfer.

We may update this policy. We'll notify you of material changes by email and by posting the updated policy on this page with a new "Last updated" date.

For privacy questions, data access requests, or complaints: **privacy@yourdomain.com**.`;

// Terms of Service — sections 1–11 of PRIVACY.md.
export const TERMS_OF_SERVICE_MARKDOWN = `PostCraft AI is a writing-assistance tool that generates draft social media posts based on your inputs and (optionally) your resume and historical style profile. **Generated content is provided as a starting point. You are responsible for reviewing and editing drafts before publishing.**

You must be at least 16 years old and able to enter into a binding agreement in your jurisdiction. By creating an account you represent that you meet these requirements.

**Your content**

- You retain ownership of content you upload (resume, raw thoughts, profile context, about me, style preferences).
- **Generated drafts are provided to you under a non-exclusive license. You own the final published version you create from them.**
- You confirm that any content you upload or generate through the service does not infringe on third-party rights (copyright, trademark, privacy, etc.).

**Acceptable use.** You agree not to:

- Use the service to generate content that is unlawful, defamatory, harassing, or misleading.
- Generate impersonation, doxxing, or content that targets a private individual.
- Use the service in any way that violates Google's Generative AI Prohibited Use Policy (since drafts are produced via Gemini).
- Reverse-engineer, decompile, or attempt to extract source code.
- Use the service in any manner that could damage, disable, overburden, or impair the service.
- Resell or sublicense the service without our written permission.
- Use automated means to scrape or bulk-generate content.

**Your account.** You're responsible for keeping your password secure, for activity that happens under your account, and for notifying us promptly if you suspect unauthorized access. We may suspend or terminate accounts that violate these terms or that abuse rate limits.

**Service availability.** The service is provided "as is" and "as available." We may modify, suspend, or discontinue the service at any time with reasonable notice. We do not guarantee uninterrupted access.

**Limitation of liability.** To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the service.

**Termination.** You can terminate your account at any time from the app settings. We may terminate or suspend your account if you violate these terms, abuse the service, or if we discontinue operations.

We may update these terms. Material changes will be communicated by email and by posting the updated terms on this page. Continued use of the service after the effective date constitutes acceptance of the updated terms.

For support: **support@yourdomain.com**. For abuse reports: **abuse@yourdomain.com**.`;

// GDPR section — kept separate so users in the EU/UK can find the
// processor list without scrolling through the full policy.
export const GDPR_NOTES_MARKDOWN = `These are the additional disclosures we make if you have any EU/UK users. **Not legal advice — get a real review.**

**Lawful basis.** We rely on **consent** for the optional use of your resume and profile context to inform generation (you can use the service without either), and on **legitimate interests** for account administration, rate limiting, error monitoring, and cost tracking. You can withdraw consent at any time by deleting the relevant data from the app or your account.

**Sub-processors**

| Sub-processor | Data | Location |
|---------------|------|----------|
| Google (Gemini API) | Topic, raw thoughts, resume, profile context, style profile, research snippets | Google's data center region per their terms |
| Sentry (if configured) | Anonymized error traces | Per your Sentry plan |

**Data subject rights.** You have the right to access your personal data, request rectification of inaccurate data, request erasure ("right to be forgotten") by deleting your account, restrict processing, receive a machine-readable copy (portability), object to processing based on legitimate interests, and lodge a complaint with your supervisory authority.

To exercise any of these, email **privacy@yourdomain.com**. We respond within 30 days.

**International transfers.** If you are in the EU/UK and our servers are not, we transfer your data under [Standard Contractual Clauses / your transfer mechanism]. The [Google DPA] applies to Gemini API processing.

**Cookies.** We do not use cookies beyond the authentication token stored by the backend. We do not use analytics or advertising cookies. If we add analytics later, we will add a cookie banner and update the consent flow.`;
