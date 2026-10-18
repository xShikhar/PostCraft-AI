# Frontend polish and behavior

Updated 15 October 2026. Design screenshots remain references, not application data.

- Home/composer/selection/editor are distinct states; sign-in/history/profile complete the seven experiences.
- Header search uses the configured API and workspace callback. History has search, platform filter, date grouping and paging.
- Quick capture uses a direct callback; home uses aggregate metrics and shows failures separately from activity.
- Account changes remount state and stale responses are ignored. Background and style save independently.
- Resume text is editable/reanalyzable; learned style and JSON export are visible. Finalized chats are retained.
- Theme logo mapping and Lato/Merriweather remain; one theme-aware toaster is mounted at root.
- Per-mouse-move layout reads were removed. CSS reduced motion complements scoped GSAP cleanup.
- Fake percentages, fabricated notification/voice data and no-op Forgot-password/Status links were removed. Remember-session controls seven-day session or 30-day local storage.

See FIX_VERIFICATION.md for actual checks. An unspecified frontend exclusion list cannot be verified.
