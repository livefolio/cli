# `strategy`

Define, evaluate, and backtest quantitative strategies. Strategy commands output JSON to stdout, except `post` which returns a plain-text link ID.

## Retrieve a strategy definition

Fetches a strategy by its link ID and outputs the full definition as JSON, including signals, allocations, and trading configuration.

```shell
livefolio strategy get <link_id>
```

| Argument | Description |
|----------|-------------|
| `link_id` | The strategy's link ID — a short nano ID (e.g. `a1b2c3`). |

**Returns**

```json
{
  "linkId": "a1b2c3",
  "name": "SPY Trend Follow",
  "trading": {
    "frequency": "Daily",
    "offset": 0
  },
  "signals": [
    {
      "name": "SPY above 200d SMA",
      "signal": {
        "left": { "type": "Price", "ticker": { "symbol": "SPY", "leverage": 1 }, "lookback": 1, "delay": 0, "unit": null, "threshold": null },
        "comparison": ">",
        "right": { "type": "SMA", "ticker": { "symbol": "SPY", "leverage": 1 }, "lookback": 200, "delay": 0, "unit": null, "threshold": null },
        "tolerance": 0
      }
    }
  ],
  "allocations": [
    {
      "name": "Risk On",
      "allocation": {
        "condition": { "kind": "signal", "signal": "..." },
        "holdings": [
          { "ticker": { "symbol": "SPY", "leverage": 1 }, "weight": 1.0 }
        ]
      }
    },
    {
      "name": "Risk Off",
      "allocation": {
        "condition": { "kind": "not", "signal": "..." },
        "holdings": [
          { "ticker": { "symbol": "TLT", "leverage": 1 }, "weight": 1.0 }
        ]
      }
    }
  ]
}
```

## Post a strategy definition

Creates a new strategy from a JSON definition and returns its link ID. The input is a full Strategy object as a JSON string (without `linkId` — one is assigned on creation).

```shell
livefolio strategy post <strategy_json>
```

| Argument | Description |
|----------|-------------|
| `strategy_json` | A Strategy definition as a JSON string. |

**Returns**

```
a1b2c3
```

## Evaluate a strategy at a point in time

Evaluates all signals and indicators for a strategy at a given date, then returns the active allocation and full diagnostic state. Defaults to the current date if `--at` is omitted.

```shell
livefolio strategy evaluate <link_id> [--at <date>]
```

| Argument | Description |
|----------|-------------|
| `link_id` | The strategy's link ID (e.g. `a1b2c3`). |
| `--at` | Optional. Evaluation date as `YYYY-MM-DD` or ISO string. Defaults to now. |

**Returns**

Signal keys follow the format `IndicatorKey_comparison_IndicatorKey_tTolerance`, where indicator keys are `Type_Symbol_Lookback` (e.g. `Price_SPY_1`). The `indicators` object is keyed by indicator key, and `signals` is keyed by signal key.

```json
{
  "asOf": "2025-06-13T00:00:00.000Z",
  "allocation": {
    "name": "Risk On",
    "holdings": [
      { "ticker": { "symbol": "SPY", "leverage": 1 }, "weight": 1.0 }
    ]
  },
  "signals": {
    "Price_SPY_1_>_SMA_SPY_200_t0": true
  },
  "indicators": {
    "Price_SPY_1": {
      "timestamp": "2025-06-13",
      "value": 605.12
    },
    "SMA_SPY_200": {
      "timestamp": "2025-06-13",
      "value": 571.34
    }
  }
}
```

## Backtest a strategy over a date range

Runs a historical backtest of the strategy between two dates and returns performance summary, daily timeseries, trade log, and annual tax breakdown.

```shell
livefolio strategy backtest <link_id> [--from <start_date>] [--to <end_date>]
```

| Argument | Description |
|----------|-------------|
| `link_id` | The strategy's link ID (e.g. `a1b2c3`). |
| `--from` | Optional. Backtest start date as `YYYY-MM-DD`. Defaults to the earliest available data. |
| `--to` | Optional. Backtest end date as `YYYY-MM-DD`. Defaults to the most recent trading day. |

**Returns**

```json
{
  "summary": {
    "initialValue": 10000,
    "finalValue": 14832.50,
    "totalReturnPct": 48.33,
    "cagrPct": 12.41,
    "maxDrawdownPct": -18.72,
    "annualizedVolatilityPct": 15.63,
    "sharpeRatio": 0.79,
    "tradeCount": 14
  },
  "timeseries": {
    "dates": ["2022-01-03", "2022-01-04", "2022-01-05"],
    "portfolio": [10000, 10045.20, 9987.30],
    "cash": [0, 0, 0],
    "drawdownPct": [0, 0, -0.58],
    "allocation": ["Risk On", "Risk On", "Risk On"]
  },
  "trades": [
    {
      "date": "2022-01-03",
      "ticker": "SPY",
      "leverage": 1,
      "shares": 21.05,
      "price": 475.25,
      "value": 10004.01,
      "action": "buy",
      "allocation": "Risk On"
    }
  ],
  "annualTax": [
    {
      "year": 2022,
      "shortTermRealizedGains": 312.40,
      "longTermRealizedGains": 0
    }
  ]
}
```
