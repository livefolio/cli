# market

Market data commands. Output is CSV (`symbol,timestamp,price`), pipe-friendly.

Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` — use `--env .env.local` or export them in your shell.

---

## `market series`

Fetch historical daily price series for one or more symbols.

```bash
livefolio --env .env.local market series SPY
livefolio --env .env.local market series SPY QQQ
livefolio --env .env.local market series SPY | head -5
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<symbols...>` | Yes | One or more ticker symbols (e.g. `SPY`, `QQQ`) |

---

## `market quotes`

Get the current price for one or more symbols.

```bash
livefolio --env .env.local market quotes SPY QQQ
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<symbols...>` | Yes | One or more ticker symbols (e.g. `SPY`, `QQQ`) |
