# `market`

Retrieve market data for one or more ticker symbols. All market commands output CSV to stdout with the header `symbol,timestamp,price`. When indicator options are added, each indicator appends an extra column to the output.

## Fetch historical daily observations

Returns the full daily price history for each symbol. Rows are ordered by symbol, then by date ascending.

```shell
livefolio market series <symbols...> [indicator options]
```

| Argument | Description |
|----------|-------------|
| `symbols` | One or more ticker symbols (e.g. `SPY`, `AAPL MSFT`). Case-insensitive — symbols are uppercased automatically. |

See [Indicator options](#indicator-options) for `--sma`, `--ema`, `--rsi`, and other flags that append computed columns.

**Returns**

```
symbol,timestamp,price
SPY,2025-01-02,592.89
SPY,2025-01-03,594.21
SPY,2025-01-06,588.95
```

## Fetch latest real-time quotes

Returns the most recent quote for each symbol — one row per symbol.

```shell
livefolio market quotes <symbols...> [indicator options]
```

| Argument | Description |
|----------|-------------|
| `symbols` | One or more ticker symbols (e.g. `SPY`, `AAPL MSFT`). Case-insensitive — symbols are uppercased automatically. |

See [Indicator options](#indicator-options) for `--sma`, `--ema`, `--rsi`, and other flags that append computed columns.

**Returns**

```
symbol,timestamp,price
SPY,2025-06-13T15:30:00Z,605.12
AAPL,2025-06-13T15:30:00Z,214.38
```

## Indicator options

Both `series` and `quotes` accept optional flags that compute technical indicators and append them as extra CSV columns. Indicators can be combined — each adds its own column.

### Indicators

Each indicator takes a `<period>` argument specifying the lookback window in trading days.

| Flag | Argument | Description | Output column |
|------|----------|-------------|---------------|
| `--sma` | `<period>` | Simple moving average — average price over the last N days | `sma_<period>` |
| `--ema` | `<period>` | Exponential moving average — exponentially weighted average price | `ema_<period>` |
| `--rsi` | `<period>` | Relative Strength Index — momentum oscillator scaled 0–100 | `rsi_<period>` |
| `--return` | `<period>` | Period return as a decimal (0.05 = 5%) | `return_<period>` |
| `--volatility` | `<period>` | Annualized volatility as a decimal | `volatility_<period>` |
| `--drawdown` | `<period>` | Percentage drawdown from the rolling peak | `drawdown_<period>` |

### Modifiers

Modifiers adjust how indicators are calculated. They have no effect on their own — use them alongside at least one indicator flag.

| Flag | Argument | Description |
|------|----------|-------------|
| `--delay` | `<days>` | Offset the indicator backward in time by N trading days |
| `--leverage` | `<factor>` | Multiply return-based calculations by the given factor |

### Examples

Single indicator on a series:

```shell
livefolio market series SPY --sma 20
```

```
symbol,timestamp,price,sma_20
SPY,2025-01-02,592.89,589.34
SPY,2025-01-03,594.21,589.87
```

Multiple symbols with two indicators:

```shell
livefolio market series AAPL MSFT --sma 50 --rsi 14
```

```
symbol,timestamp,price,sma_50,rsi_14
AAPL,2025-01-02,243.56,240.12,62.3
AAPL,2025-01-03,244.10,240.35,63.1
MSFT,2025-01-02,421.80,418.50,58.7
MSFT,2025-01-03,423.15,418.92,59.4
```

Combining an indicator with modifiers:

```shell
livefolio market series SPY --return 20 --delay 5 --leverage 2
```

```
symbol,timestamp,price,return_20
SPY,2025-01-02,592.89,0.0342
SPY,2025-01-03,594.21,0.0358
```

Indicators work with quotes too:

```shell
livefolio market quotes SPY AAPL --ema 12
```

```
symbol,timestamp,price,ema_12
SPY,2025-06-13T15:30:00Z,605.12,601.48
AAPL,2025-06-13T15:30:00Z,214.38,212.90
```
