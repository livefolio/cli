<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-01 | Updated: 2026-04-01 -->

# specs

## Purpose
Design specifications defining the requirements, API surface, and behavior for each CLI feature. Specs are written before implementation plans and serve as the source of truth for expected behavior.

## Key Files

| File | Description |
|------|-------------|
| `2026-03-31-indicator-command-design.md` | Spec for indicator types, CLI interface, and output formats |
| `2026-04-01-signal-tolerance-design.md` | Spec for signal tolerance (`~N`) and delay (`@N`) features |
| `2026-04-01-strategy-command-design.md` | Spec for strategy JSON schema, subcommands (post/run/series) |
| `2026-04-01-strategy-get-roundtrip-design.md` | Spec for strategy get round-trip serialization output |
| `2026-04-01-strategy-series-design.md` | Spec for strategy allocation series output and filtering |
| `2026-04-01-unified-command-parsing-design.md` | Spec for unified parsing of indicator/signal spec strings |

## For AI Agents

### Working In This Directory
- Specs are read-only reference material — do not modify completed specs
- When designing a new feature, create a new spec file with today's date prefix
- Specs define the "what and why"; implementation plans in `../plans/` define the "how"

<!-- MANUAL: -->
