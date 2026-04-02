<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# src

## Purpose
All application source code for the CLI. Entry point registers three Commander.js subcommands (indicator, signal, strategy) with shared parsing and formatting utilities in `lib/`.

## Key Files

| File | Description |
|------|-------------|
| `index.ts` | CLI entry point — creates Commander program, registers all subcommands |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `commands/` | Command implementations: indicator, signal, strategy (see `commands/AGENTS.md`) |
| `lib/` | Shared utilities: Supabase client, output formatting, spec parsing (see `lib/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `index.ts` should only register commands — keep command logic in `commands/`
- All imports use `.js` extensions (ESM requirement)
- Each command module exports a `make*Command()` factory function

### Testing Requirements
- Tests are co-located as `*.test.ts` files
- Run `npm test` from the project root

### Common Patterns
- Commands follow the pattern: parse args -> validate -> readEnv -> buildClient -> execute -> format output
- Error handling uses `console.error` + `process.exit(1)`

## Dependencies

### Internal
- `@livefolio/sdk` — all SDK types and client methods

### External
- `commander` — CLI framework (imported in every command file)

<!-- MANUAL: -->
