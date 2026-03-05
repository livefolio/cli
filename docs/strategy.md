# Strategy Commands

## `strategy get <link_id>`

Fetch a strategy definition. Output: JSON.

```bash
livefolio strategy get bCicNI7OI2x
```

## `strategy evaluate <link_id> [--at <date>]`

Evaluate a strategy (signals, allocation, indicators). Output: JSON.

```bash
livefolio strategy evaluate bCicNI7OI2x
livefolio strategy evaluate bCicNI7OI2x --at 2025-05-12T21:00:00Z
```

## `strategy symbols <link_id>`

List symbols used by a strategy, one per line. Useful for piping.

```bash
livefolio strategy symbols bCicNI7OI2x
# SPY
# QQQ
# TLT
```

## `strategy stream <link_id>`

Stream-evaluate a strategy with observations from stdin. Input: CSV (`symbol,timestamp,price`).

```bash
livefolio strategy symbols bCicNI7OI2x | xargs livefolio market quotes | livefolio strategy stream bCicNI7OI2x
```

## Piping

Commands are designed for composition:

```bash
# symbols → quotes → stream (full live evaluation pipeline)
livefolio strategy symbols <id> | xargs livefolio market quotes | livefolio strategy stream <id>
```
