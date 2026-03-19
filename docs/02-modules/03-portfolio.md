# `portfolio`

Manage brokerage connections, view positions and orders, and execute trades. The portfolio module wraps [SnapTrade](https://snaptrade.com) to provide unified access to your brokerage accounts. Use `portfolio connect` to link a brokerage before running other commands.

## Input format

Commands that accept structured input — **trade**, **cancel-orders**, and **rebalance** — accept positional arguments for single operations or `--json` for batch operations. All commands return JSON.

## Connect a brokerage

Opens the SnapTrade connection portal in your default browser. Optionally filter to a specific brokerage. Complete the authorization flow in the browser to link the account.

```shell
livefolio portfolio connect [brokerage]
```

| Argument | Description |
|----------|-------------|
| `brokerage` | Optional. Brokerage name to pre-select (e.g. `alpaca`, `interactive_brokers`). Omit to see all available brokerages. |

**Returns**

```
https://app.snaptrade.com/connect/...
```

## List brokerage connections

Returns all linked brokerage connections for your account.

```shell
livefolio portfolio connections
```

**Returns**

```json
[
  {
    "id": "conn_abc123",
    "brokerage": "Alpaca",
    "status": "active",
    "createdAt": "2025-03-01T10:00:00Z"
  }
]
```

## List accounts

Returns all brokerage accounts across your connections.

```shell
livefolio portfolio accounts
```

**Returns**

```json
[
  {
    "id": "acct_xyz789",
    "connectionId": "conn_abc123",
    "name": "Individual Brokerage",
    "number": "****1234",
    "type": "margin"
  }
]
```

## Reconnect a brokerage

Opens the SnapTrade reconnection portal for a broken or expired connection. Complete the flow in the browser to restore access.

```shell
livefolio portfolio reconnect <connection_id>
```

| Argument | Description |
|----------|-------------|
| `connection_id` | The connection ID to reconnect (e.g. `conn_abc123`). |

**Returns**

```
https://app.snaptrade.com/reconnect/...
```

## Disconnect a brokerage

Removes a brokerage connection and all associated data. Produces no output on success.

```shell
livefolio portfolio disconnect <connection_id>
```

| Argument | Description |
|----------|-------------|
| `connection_id` | The connection ID to remove (e.g. `conn_abc123`). |

## View positions

Returns current holdings including cash balances. Without an account ID, returns positions across all accounts and connections.

```shell
livefolio portfolio positions [account_id]
```

| Argument | Description |
|----------|-------------|
| `account_id` | Optional. Scope positions to a single account. Omit to see positions across all accounts. |

**Returns**

```json
[
  {
    "accountId": "acct_xyz789",
    "symbol": "SPY",
    "quantity": 50,
    "marketValue": 30256.00,
    "averageCost": 580.12,
    "currency": "USD"
  },
  {
    "accountId": "acct_xyz789",
    "symbol": null,
    "quantity": null,
    "marketValue": 4820.35,
    "averageCost": null,
    "currency": "USD"
  }
]
```

A position with `"symbol": null` represents a cash balance.

## View recent orders

Returns recent orders for a given account.

```shell
livefolio portfolio orders <account_id>
```

| Argument | Description |
|----------|-------------|
| `account_id` | The account to list orders for (e.g. `acct_xyz789`). |

**Returns**

```json
[
  {
    "id": "ord_001",
    "symbol": "SPY",
    "action": "buy",
    "orderType": "market",
    "totalShares": 10,
    "filledShares": 10,
    "executionPrice": 581.23,
    "timeInForce": "day",
    "status": "filled",
    "createdAt": "2025-06-12T14:30:00Z",
    "filledAt": "2025-06-12T14:32:00Z"
  }
]
```

## Place trades

Submits one or more trades. Accepts positional args for a single trade, or `--json` for batch trades.

```shell
# Market order (default)
livefolio portfolio trade <account_id> <action> <symbol> --shares <number>

# Limit order
livefolio portfolio trade <account_id> buy SPY --shares 10 --orderType limit --limitPrice 580.00

# Notional order (dollar amount)
livefolio portfolio trade <account_id> buy SPY --notional 5000

# Batch trades via JSON
livefolio portfolio trade <account_id> --json '[{"action":"buy","symbol":"SPY","shares":10,"orderType":"limit","limitPrice":580.00}]'
```

| Argument       | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| `account_id`   | The account to trade in (e.g. `acct_xyz789`).                              |
| `action`       | `buy` or `sell`.                                                            |
| `symbol`       | Ticker symbol (e.g. `SPY`).                                                |
| `--shares`     | Number of shares. Required unless `--notional` is provided.                |
| `--notional`   | Dollar amount to trade. Required unless `--shares` is provided.            |
| `--orderType`  | `market` (default), `limit`, `stop`, or `stopLimit`.                       |
| `--limitPrice` | Limit price. Required when orderType is `limit` or `stopLimit`.            |
| `--stopPrice`  | Stop trigger price. Required when orderType is `stop` or `stopLimit`.      |
| `--timeInForce`| `day` (default) or `gtc` (good-till-cancel).                               |

**Returns**

```json
[
  {
    "id": "ord_002",
    "symbol": "SPY",
    "action": "buy",
    "orderType": "limit",
    "shares": 10,
    "limitPrice": 580.00,
    "timeInForce": "day",
    "status": "submitted"
  }
]
```

## Cancel orders

Cancels one or more open orders. Accepts positional order IDs, or `--json` for batch cancellation.

```shell
# Positional order IDs
livefolio portfolio cancel-orders <order_ids...>

# Via JSON
livefolio portfolio cancel-orders --json '["ord_001","ord_002"]'
```

| Argument | Description |
|----------|-------------|
| `order_ids` | One or more order IDs to cancel (e.g. `ord_001 ord_002`). |

**Returns**

```json
[
  {
    "id": "ord_001",
    "symbol": "SPY",
    "action": "buy",
    "orderType": "limit",
    "shares": 10,
    "status": "cancelled"
  }
]
```

## Rebalance an account

Computes the trades needed to rebalance an account toward a target allocation, then submits them. Specify the allocation as ticker/weight pairs. Weights should sum to 1.0.

```shell
# Positional tickers and weights
livefolio portfolio rebalance <account_id> --tickers SPY TLT --weights 0.6 0.4

# Via JSON
livefolio portfolio rebalance <account_id> --json '{"SPY":0.6,"TLT":0.4}'
```

| Argument | Description |
|----------|-------------|
| `account_id` | The account to rebalance (e.g. `acct_xyz789`). |
| `--tickers` | Space-separated ticker symbols. |
| `--weights` | Space-separated target weights (must match `--tickers` in length, sum to 1.0). |

**Returns**

```json
[
  {
    "id": "ord_003",
    "symbol": "SPY",
    "action": "buy",
    "orderType": "market",
    "shares": 5,
    "estimatedPrice": 605.12,
    "status": "submitted"
  },
  {
    "id": "ord_004",
    "symbol": "TLT",
    "action": "sell",
    "orderType": "market",
    "shares": 3,
    "estimatedPrice": 91.45,
    "status": "submitted"
  }
]
```
