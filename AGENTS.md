# Agent Dashboard project guide

- This is a TypeScript Obsidian community plugin project, not an Obsidian Vault.
- Plugin ID: `agent-dashboard`; display name: `Agent Dashboard`; version: `0.1.0`.
- Common commands: `npm install`, `npm run dev`, `npm run build`, and `npm run lint`.
- The final Obsidian plugin directory only needs `main.js`, `manifest.json`, and `styles.css`.
- Prefer Obsidian's official public API; do not depend on undocumented internal APIs.
- Keep the first release minimal, testable, and iterative. Do not casually add production dependencies.
- Explain and wait for confirmation before network requests, telemetry, cloud sync, file deletion, or modifying a real Vault.
- For dashboard UI tasks, consult the `frontend-design` skill first. For Obsidian API, lifecycle, manifest, security, accessibility, and review rules, consult the `obsidian-plugin-skill` skill first.
- Never commit API keys, tokens, local Vault paths, or private data.
- Do not create Git remotes, publish repositories, or run `git commit` unless explicitly requested.
- Before broad changes, state the goal, affected files, and minimal implementation approach.
- After changing code, run build and lint when available; finish by summarizing changes and verification.
