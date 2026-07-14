# GitHub automation

This repository uses GitHub Actions for three jobs:

- `.github/workflows/lint.yml` runs the build and lint checks for pushes and pull requests.
- `.github/workflows/pages.yml` publishes `prototype/simple-dashboard/` to GitHub Pages when `main` changes.
- `.github/workflows/release.yml` builds and publishes the Obsidian plugin when a version tag is pushed.

## One-time GitHub Pages setup

In the GitHub repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The next push to `main` that changes the prototype will publish the preview. The workflow can also be started manually from **Actions → Deploy dashboard prototype → Run workflow**.

## Publish an Obsidian plugin release

Keep the version in `package.json`, `manifest.json`, and `versions.json` consistent. Then create and push a matching version tag such as `0.1.0`. The release workflow verifies the versions, builds the plugin, and publishes:

- `main.js`
- `manifest.json`
- `styles.css`
- `agent-dashboard-0.1.0.zip`

The workflow uses GitHub's built-in `GITHUB_TOKEN`; no personal token belongs in this repository.

Only source code and the static prototype should be stored here. Never add a real Vault, private notes, API keys, tokens, or local Vault paths.
