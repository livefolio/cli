# Command structure

Every CLI invocation follows a consistent structure: a module, a command within that module, and zero or more arguments. Structured output is written to stdout; errors are written to stderr with a non-zero exit code. This convention makes the CLI easy to integrate into scripts, pipelines, and AI agent workflows.

```shell
livefolio [module] [command] [...args]
```

## Modules

The CLI is organized into four modules:

| Module | Description |
|--------|-------------|
| `auth` | Authentication — log in, check status, log out |
| `market` | Market data — historical price series and real-time quotes |
| `portfolio` | Portfolio management — holdings, rebalancing, and drift analysis |
| `strategy` | Strategy definitions and evaluation |

Each module groups related commands. Run `livefolio <module> --help` to list the available commands within a module.

See the [Modules](../02-modules/) section for detailed documentation of each command, including arguments, options, and example output.

## Command arguments

Named options use `--key value` syntax. All flags are case-sensitive and prefixed with `--`. Positional arguments are passed directly after the command name.

```shell
livefolio strategy evaluate bCicNI7OI2x --at 2025-05-12T21:00:00Z
livefolio market series SPY QQQ
```

For AI agents and programmatic use, some commands accept structured input via `--json` or `--csv` flags. All command output is machine-parsable by default — no additional flags are needed to get structured responses.

```shell
livefolio market series --csv "SPY,QQQ,IWM"
```

Standard shell piping and file redirection work as expected with all commands:

```shell
livefolio market series SPY | head -5
livefolio market series SPY > spy.csv
livefolio strategy evaluate bCicNI7OI2x | jq '.signals'
```

## Return types

**Plain text** — Simple confirmations and status messages, such as those returned by `auth status` and `auth logout`. These are returned as a single line printed to stdout.

**CSV** — Time-series and tabular data, primarily from market commands. Output includes a header row followed by data rows. The standard format is `symbol,timestamp,price`.

```
symbol,timestamp,price
SPY,2025-01-10T16:00:00Z,590.25
SPY,2025-01-11T16:00:00Z,592.10
```

**JSON** — Structured objects returned by strategy and portfolio commands. Output is pretty-printed with 2-space indentation for readability.

```json
{
  "name": "My Strategy",
  "asOf": "2025-05-12T21:00:00Z",
  "allocation": [ ... ],
  "signals": [ ... ]
}
```