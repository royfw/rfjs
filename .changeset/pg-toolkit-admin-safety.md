---
"@rfjs/pg-toolkit": patch
---

fix(pg-toolkit): repair admin connection string and escape SQL identifiers

- `checkAndCreateDB` rebuilt the admin connection string by hand
  (`postgres://${user}:${password}@${host}:${port}/postgres`), which corrupted
  credentials containing URL-special characters and emitted an empty port when
  the source string had none. It now connects with structured fields and never
  re-serialises the URL.
- Schema, database and seed-history table names were interpolated into SQL with
  only bare double quotes, allowing identifier injection. They are now escaped
  with a new exported `quoteIdent` helper (doubles embedded quotes, rejects null
  bytes).
- Move `@types/pg` to `dependencies` — the published `admin` typings import
  `Client`/`Pool` from `pg`, so consumers need the types at install time.
- Drop the dangling `LICENSE` entry from `files` (no such file) and ship
  `README.zh-TW.md` instead.
