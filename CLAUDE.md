# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptStash is a cross-platform prompt management tool. The Electron app serves as the data hub — managing SQLite storage and exposing a local HTTP API on port 9877. Chrome extension and Alfred workflow are thin HTTP clients.

## Commands

```bash
# Install
pnpm install

# Development
pnpm dev:server          # Standalone API server (no Electron, uses temp DB)
pnpm dev:electron        # Full Electron dev: esbuild watch + Vite HMR + Electron

# Build
pnpm build:electron      # Core tsc → esbuild main → Vite renderer → native rebuild
pnpm build:extension     # Chrome extension via Vite

# Test (Vitest, core package only)
pnpm test                # All packages
pnpm test:core           # Core only
pnpm --filter @promptstash/core test -- prompt-repo.test.ts  # Single test file
```

## Architecture

**Monorepo** (pnpm workspaces) with 4 packages:

- **`packages/core`** — ESM. SQLite (better-sqlite3 + WAL + FTS5), repository classes (`PromptRepo`, `CategoryRepo`, `TagRepo`), keyword `Classifier`, JSON import/export. Only package with tests.
- **`packages/electron`** — Main process: Fastify server + tray + global shortcuts (`Cmd+Shift+P` search, `Cmd+Shift+Alt+S` save clipboard). Tray menu also has "Save Clipboard". Renderer: React 19 + Tailwind v4 + Vite. Main process TypeScript is bundled to CJS via esbuild (resolves ESM/CJS mismatch with core).
- **`packages/chrome-extension`** — Manifest V3. Context menu save, inline search triggers (`/p ` or `;p `), popup with auto-classify.
- **`packages/alfred-workflow`** — Save clipboard + search via Alfred JSON protocol.

**Data flow:** All clients → HTTP API (`127.0.0.1:9877`) → SQLite via core repos.

## Key Technical Details

- **Module system:** Core is ESM; Electron main is bundled to CJS by esbuild (external: `electron`, `better-sqlite3`). The esbuild step resolves the ESM→CJS incompatibility.
- **better-sqlite3 native module** must be rebuilt when switching between system Node and Electron's Node ABI. The `native-rebuild.mjs` script handles this. If you see `NODE_MODULE_VERSION` errors, run `pnpm rebuild better-sqlite3`.
- **Tailwind v4** requires `@tailwindcss/vite` plugin in the Vite config (not PostCSS).
- **Fastify CORS** is enabled (`origin: true`) for dev server cross-origin access.
- **Database initialization** creates tables + FTS5 virtual table + auto-sync triggers. `CategoryRepo.seedDefaults()` creates 6 default categories on first run.
- **npm registry** is set to `registry.npmmirror.com` in `.npmrc`.

## API Endpoints (127.0.0.1:9877)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/categories` | List categories |
| GET | `/api/tags` | List tags |
| GET | `/api/prompts/search?q=&categoryId=&tag=` | FTS search |
| GET | `/api/prompts/:id` | Get prompt |
| POST | `/api/prompts` | Create prompt |
| POST | `/api/prompts/:id/use` | Increment usage |
| POST | `/api/prompts/:id/favorite` | Toggle favorite |
| DELETE | `/api/prompts/:id` | Delete prompt |
| POST | `/api/prompts/classify` | Auto-classify content |
| POST | `/api/generate/start` | Start prompt generation session |
| POST | `/api/generate/refine` | Refine with feedback |
| POST | `/api/generate/save` | Save generated prompt |
| DELETE | `/api/generate/:sessionId` | Discard session |

## Testing

Tests are in `packages/core/src/__tests__/`. Each test creates a temp SQLite DB for isolation and cleans up after. Covers: repos, classifier, import/export roundtrip, and Fastify server endpoints.
