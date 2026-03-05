# Market Commands

## `market series <symbols...>`

Fetch historical daily series. Output: CSV (`symbol,timestamp,price`).

```bash
livefolio market series SPY QQQ
```

## `market quotes <symbols...>`

Get current prices. Output: CSV (`symbol,timestamp,price`).

```bash
livefolio market quotes SPY QQQ
```
