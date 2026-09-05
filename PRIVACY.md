# Privacy Policy

**Last updated:** 2026-09-05
**Effective date:** 2026-09-05

PostCraft AI ("we", "our", "us") is a writing-assistance tool. This policy
describes what data we collect, why, how long we keep it, and what choices
you have.

> **This is a starting template based on what the application actually does
> as of the date above. It is not legal advice. Get a real legal review
> before relying on it, especially once you accept payment or exceed ~1,000
> active users.**

---

## 1. What we collect

When you use PostCraft AI, we collect:

### 1.1 Account data
- **Username** — chosen by you at signup. Unique identifier.
- **Password hash** — Argon2id hash of your password. We never store the
  plaintext.
- **Authentication tokens** — short-lived JWTs issued at login, used to
  authorize API requests.

### 1.2 Content you provide
- **Resume** (optional) — if you upload a resume, we extract and store the
  plain text. This is encrypted at rest using Fernet (AES-CBC + HMAC). The
  raw text is used to generate context-aware posts on your behalf and is
  not used for any other purpose.
- **Draft input** — the topic, raw thoughts, and platform (LinkedIn, X)
  you submit when generating a post. Used to drive the generation pipeline
  and improve your drafts.
- **Generated drafts** — the three drafts we generate for each request,
  your edits, and your final selected version. Stored in your account
  history.
- **Style profile** — patterns we extract from your finalized posts:
  structure, tone, pacing, storytelling technique, formatting, and CTA
  style. Used to make future generations sound more like you.
- **Profile context** — the free-text field where you describe your
  background, goals, and writing style preferences.
- **About me** — the short bio you provide in the Persona Engine.

### 1.3 Research data (third-party)
- **Public web search snippets** — when you request a generation, we may
  search the public web for relevant context. We store a research cache
  keyed by topic + platform so we don't re-run the same search. The cache
  contains public snippets only, no user-identifying information beyond
  the topic string itself.

### 1.4 Service data
- **Cost logs** — token counts and estimated cost for each LLM call. Used
  to monitor service costs. Not linked to your identity in the UI but is
  associated with your generation in the database.
- **Request metadata** — IP address, request timestamp, user agent. Used
  for rate limiting and abuse detection.

---

## 2. How we use your data

- **To provide the service** — generate drafts, learn your style, save
  your history, let you revisit and edit previous generations.
- **To maintain and improve the service** — monitor costs, detect
  abuse, debug errors.
- **We do not:** sell your data, share it with advertisers, or use your
  resume or drafts to train third-party models.

---

## 3. Third-party processors

To provide the service we share the following data with:

- **Google (Gemini API)** — the topic, your raw thoughts, your resume
  text (if uploaded), your profile context, your style profile, and the
  research snippets are sent to Google's Gemini API to generate drafts
  and extract style patterns. Google's API terms govern their use of this
  data. **Read Google's API terms to confirm your usage is within them —
  the relevant document is the Gemini API Terms of Service and the
  Generative AI Prohibited Use Policy.**
- **PostgreSQL (self-hosted)** — your account data and content, stored
  in our database.
- **ChromaDB (self-hosted)** — your style profile vectors, used for
  similarity lookup during generation.
- **Sentry (optional, self-hosted or SaaS)** — error reports from the
  backend. We do not send PII to Sentry by default (drafts, resume text,
  and chat history are excluded).

---

## 4. How long we keep your data

| Data | Retention |
|------|-----------|
| Account | Until you delete your account |
| Resume (raw text + summary) | Until you delete it or your account |
| Generated drafts + history | Until you delete them or your account |
| Style profile | Until you delete it or your account |
| Research cache | 30 days (configurable; cleans up expired entries) |
| Cost logs | Indefinite, used for service cost monitoring |
| Request metadata (IP, UA) | 7 days (for rate limiting and abuse detection) |

When you delete your account, all account-linked data is permanently
deleted from our database and vector store within seconds. Cost logs
(which reference generation IDs but not your identity) are retained.

---

## 5. Your rights

- **Access** — request a copy of your data. Use the in-app export
  feature, or email us.
- **Correction** — edit your profile context, about me, and style
  preferences in the app.
- **Deletion** — delete your account and all associated data from the
  app settings.
- **Portability** — request a machine-readable export of your data.

If you're in the EU/UK, GDPR also gives you the right to restrict
processing, object to processing, and lodge a complaint with your
supervisory authority.

---

## 6. Security

We encrypt resume PII at rest using Fernet (AES-128 in CBC mode +
HMAC-SHA256). Database connections are encrypted with TLS in production.
Authentication tokens are JWTs signed with a server-side secret. Rate
limiting is applied to authentication and generation endpoints.

**See `DEPLOYMENT.md` for the production security configuration.**

---

## 7. Children

PostCraft AI is not intended for users under 16. We do not knowingly
collect data from children. If you believe a child has created an
account, contact us to have it deleted.

---

## 8. International transfers

If you use the service from outside the country where our servers are
located, your data will be transferred across borders. By using the
service you consent to this transfer.

---

## 9. Changes to this policy

We may update this policy. We'll notify you of material changes by email
(if you've provided one) and by posting the updated policy on this page
with a new "Last updated" date.

---

## 10. Contact

For privacy questions, data access requests, or complaints:

- **Email:** privacy@yourdomain.com
- **Postal:** [your company address]

---

# Terms of Service

**Last updated:** 2026-09-05
**Effective date:** 2026-09-05

By using PostCraft AI you agree to these terms.

> **Starting template — not legal advice. Get a real legal review before
> relying on it, especially once you accept payment or have meaningful
> scale.**

---

## 1. The service

PostCraft AI is a writing-assistance tool that generates draft social
media posts based on your inputs and (optionally) your resume and
historical style profile. **Generated content is provided as a starting
point. You are responsible for reviewing and editing drafts before
publishing.**

## 2. Eligibility

You must be at least 16 years old and able to enter into a binding
agreement in your jurisdiction. By creating an account you represent
that you meet these requirements.

## 3. Your content

- You retain ownership of content you upload (resume, raw thoughts,
  profile context, about me, style preferences).
- **Generated drafts are provided to you under a non-exclusive license.
  You own the final published version you create from them.**
- You confirm that any content you upload or generate through the
  service does not infringe on third-party rights (copyright,
  trademark, privacy, etc.).

## 4. Acceptable use

You agree not to:

- Use the service to generate content that is unlawful, defamatory,
  harassing, or misleading
- Generate impersonation, doxxing, or content that targets a private
  individual
- Use the service in any way that violates Google's Generative AI
  Prohibited Use Policy (since drafts are produced via Gemini)
- Reverse-engineer, decompile, or attempt to extract source code
- Use the service in any manner that could damage, disable, overburden,
  or impair the service
- Resell or sublicense the service without our written permission
- Use automated means to scrape or bulk-generate content

## 5. Your account

You're responsible for:

- Keeping your password secure
- Activity that happens under your account
- Notifying us promptly if you suspect unauthorized access

We may suspend or terminate accounts that violate these terms or that
abuse rate limits.

## 6. Service availability

The service is provided "as is" and "as available." We may modify,
suspend, or discontinue the service at any time with reasonable notice.
We do not guarantee uninterrupted access.

## 7. Limitation of liability

To the maximum extent permitted by law, we are not liable for indirect,
incidental, special, consequential, or punitive damages, including
loss of profits, data, or goodwill, arising from your use of the
service.

## 8. Termination

You can terminate your account at any time from the app settings.
We may terminate or suspend your account if you violate these terms,
abuse the service, or if we discontinue operations.

## 9. Changes to these terms

We may update these terms. Material changes will be communicated by
email and by posting the updated terms on this page. Continued use of
the service after the effective date constitutes acceptance of the
updated terms.

## 10. Governing law

These terms are governed by the laws of [your jurisdiction]. Any
disputes will be resolved in the courts of [your jurisdiction].

## 11. Contact

- **Email:** support@yourdomain.com
- **Abuse reports:** abuse@yourdomain.com

---

# GDPR Notes (EU/UK)

These are the additional disclosures you need if you have any EU/UK
users. **Not legal advice — get a real review.**

## Lawful basis

We rely on **consent** for the optional use of your resume and profile
context to inform generation (you can use the service without either),
and on **legitimate interests** for account administration, rate
limiting, error monitoring, and cost tracking. You can withdraw consent
at any time by deleting the relevant data from the app or your account.

## Sub-processors

| Sub-processor | Data | Location |
|---------------|------|----------|
| Google (Gemini API) | Topic, raw thoughts, resume, profile context, style profile, research snippets | Google's data center region per their terms |
| Sentry (if configured) | Anonymized error traces | Per your Sentry plan |

## Data subject rights

You have the right to:

- **Access** your personal data
- **Rectification** of inaccurate data
- **Erasure** ("right to be forgotten") — delete your account
- **Restriction** of processing — request we stop processing while a
  dispute is resolved
- **Portability** — receive a machine-readable copy of your data
- **Object** to processing based on legitimate interests
- **Lodge a complaint** with your supervisory authority

To exercise any of these, email privacy@yourdomain.com. We respond
within 30 days.

## International transfers

If you are in the EU/UK and our servers are not, we transfer your data
under [Standard Contractual Clauses / your transfer mechanism]. The
[Google DPA] applies to Gemini API processing.

## Cookies

We do not use cookies beyond the authentication token stored by the
backend. We do not use analytics or advertising cookies. **If you add
analytics later (Google Analytics, Plausible, etc.) you will need a
cookie banner and updated consent flow.**
