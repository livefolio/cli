<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# @livefolio/cli

## Purpose
Commander.js CLI for evaluating financial indicators, signals, and tactical allocation strategies. Wraps the `@livefolio/sdk` to provide terminal access to Supabase-backed market data and strategy simulation.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Project manifest — `@livefolio/cli` v0.0.1, bin entry `livefolio` |
| `tsconfig.json` | TypeScript strict mode, ES2022 target, bundler module resolution |
| `vitest.config.ts` | Vitest test runner configuration |
| `eslint.config.js` | ESLint + Prettier configuration |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | All application source code (see `src/AGENTS.md`) |
| `docs/` | Design specs and implementation plans (see `docs/AGENTS.md`) |
| `.husky/` | Git hooks — pre-commit runs lint-staged (see `.husky/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- This is an ESM project (`"type": "module"`) — imports use extensionless paths (bundled by tsup)
- TypeScript strict mode is enforced; do not use `any` without justification
- The SDK dependency is a local file link (`file:../sdk`) — do not change it
- Pre-commit hooks run ESLint + Prettier via husky/lint-staged

### Testing Requirements
- Run `npm test` (vitest) before committing
- Tests live alongside source files as `*.test.ts`
- Test files are excluded from the build via `tsconfig.json`

### Environment Variables
- `SUPABASE_URL` — required, Supabase project URL
- `SUPABASE_KEY` — required, Supabase anon/service key
- `FRED_API_KEY` — required only for treasury indicator types (T3M, T10Y, etc.)

### Build & Run
- `npm run build` bundles to `dist/` via tsup
- `node dist/index.js <command>` or `npx livefolio <command>`

## Dependencies

### Internal
- `@livefolio/sdk` (file:../sdk) — core client, indicator/signal/strategy handles

### External
- `commander` ^13 — CLI framework
- `@supabase/supabase-js` ^2 — Supabase client

<!-- MANUAL: -->
