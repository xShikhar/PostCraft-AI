# Privacy Policy

Updated 20 October 2026.

PostCraft AI collects your username, password hash, consent version/time, writing inputs, drafts, chat history, optional resume and profile data, learned preferences, research results and estimated usage information to provide the writing service.

**Processing.** Gemini receives the inputs needed for generation, editing, judging and resume analysis. Tavily/SerpApi receive search queries. PostgreSQL stores account/content data; Chroma stores style descriptions. These providers process information under their own terms and the operator's account settings. The application does not run model-training jobs; it cannot make promises about a provider's independent retention or training policies.

**Optional background.** Resume summaries, about-me and saved background notes are used only when the request's context toggle is on. Writing-style instructions and learned preferences are separate. You can edit or remove optional data and export your account data from Profile & Voice.

**Storage security.** Resume text/summary, private profile fields, preferences and saved context snapshots are encrypted with Fernet (AES-128-CBC plus authentication). Drafts, raw thoughts, chats and style descriptions are ordinary application data protected by database access controls. Managed public PostgreSQL can use verified TLS; a self-hosted private database network must be configured separately. Browser tokens are stored in session storage (seven-day default) or local storage (30-day Remember), not cookies. CSP and sanitized markdown reduce injection risk without making browser token storage inaccessible to JavaScript.

**Retention and deletion.** Account-linked content is kept until account deletion. Removing a resume removes its active row; older drafts may still contain text you previously generated. Research cache keys are topic hashes; public snippets/provenance are valid for 24 hours and expired rows are periodically removed. Cost logs linked to your generations are deleted with the account. Audit access records are retained with deleted account references nulled. Deletion commits SQL cleanup and a durable vector erasure job; external failures produce pending status and automatic retries, so erasure is not guaranteed within seconds. Backups and external provider copies follow the operator/provider retention arrangements.

**Your choices.** Profile & Voice provides correction, optional-context removal, JSON export and typed-confirmation account deletion. For unresolved access, privacy or support requests, contact the operator through the channel where you received access to this service. Production operators must publish their real identity, support contact, processing locations and applicable transfer arrangements before public release.

We do not intentionally offer the service to children under 16. Material policy changes should be communicated by the operator and reflected in the agreement version. This technical disclosure is not a certification of legal compliance.

# Terms of Service

PostCraft AI is a writing-assistance service. Generated and edited text can contain errors; review facts, claims, placeholders, originality and suitability before publishing. Quality scores are estimates, not guarantees.

You retain your rights in content you provide. You are responsible for having permission to upload it and for the final content you publish. Do not use the service for unlawful, deceptive, abusive, impersonating or infringing activity, or to bypass provider restrictions.

Keep account credentials secure. Signup records agreement to the current terms version and privacy disclosure. Default sessions last seven days; Remember sessions last 30 days. Administrators can inspect account content for operating the service; authenticated administrative access is logged.

Service availability depends on hosting and external providers. Quotas, outages and maintenance can prevent generation or delay external data erasure. The application provides no guarantee of engagement, revenue, factual correctness or continuous availability.

You may export or delete your account in Profile & Voice. External erasure failures are retried with a pending status. The operator must supply actual business identity, contact details and applicable contractual/legal terms before public release. Contact the operator through the channel where you obtained service access until those details are published.
