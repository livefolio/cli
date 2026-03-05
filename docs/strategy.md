# strategy

Strategy commands. Output is JSON.

Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` — use `--env .env.local` or export them in your shell.

---

## `strategy get`

Fetch a strategy definition by its link ID.

```bash
livefolio --env .env.local strategy get bCicNI7OI2x
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<link_id>` | Yes | The strategy's link ID |

---

## `strategy evaluate`

Evaluate a strategy — computes signals, conditions, and the resulting allocation.

```bash
livefolio --env .env.local strategy evaluate bCicNI7OI2x
livefolio --env .env.local strategy evaluate bCicNI7OI2x --at 2025-05-12T21:00:00Z
```

| Argument / Option | Required | Description |
|-------------------|----------|-------------|
| `<link_id>` | Yes | The strategy's link ID |
| `--at <date>` | No | Evaluation date (ISO 8601 or `YYYY-MM-DD`). Defaults to now. |
