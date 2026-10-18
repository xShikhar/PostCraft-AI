// Run the full deterministic UI suite against an already running server.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const env = {
  ...process.env,
  BASE_URL: process.env.BASE_URL || "http://127.0.0.1:3131",
};
for (const file of [
  "auth-redesign.mjs",
  "workspace-redesign.mjs",
  "redesign.mjs",
  "admin-redesign.mjs",
  "profile-history-redesign.mjs",
  "navigation-redesign.mjs",
]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(file, import.meta.url))],
    { stdio: "inherit", env },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  "PostCraft browser smoke suite passed. API fixture coverage; run real-backend.mjs separately for persistence.",
);
