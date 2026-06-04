---
"@rfjs/pg-toolkit": patch
---

fix(pg-toolkit): tolerate non-URL DSNs and make pg an optional peer

- `getConnectionStringInfo` no longer throws on a libpq keyword/value DSN
  (`host=... dbname=...`) or an empty string. The URL parse is now optional; for
  non-URL inputs it falls back to the parsed config and returns the connection
  string unchanged.
- `pg` (and `@types/pg`) moved from `dependencies` to optional
  `peerDependencies`. Only the `./admin` entry point needs `pg`; consumers of the
  `./pure` utilities no longer pull the driver in. Admin consumers install `pg`
  themselves (its types are re-exported from the admin typings).
