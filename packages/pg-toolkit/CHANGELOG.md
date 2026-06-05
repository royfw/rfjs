# @rfjs/pg-toolkit

## 0.0.9

### Patch Changes

- cb92c84: fix(pg-toolkit): repair admin connection string and escape SQL identifiers

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

- 67b226d: fix(pg-toolkit): tolerate non-URL DSNs and make pg an optional peer

  - `getConnectionStringInfo` no longer throws on a libpq keyword/value DSN
    (`host=... dbname=...`) or an empty string. The URL parse is now optional; for
    non-URL inputs it falls back to the parsed config and returns the connection
    string unchanged.
  - `pg` (and `@types/pg`) moved from `dependencies` to optional
    `peerDependencies`. Only the `./admin` entry point needs `pg`; consumers of the
    `./pure` utilities no longer pull the driver in. Admin consumers install `pg`
    themselves (its types are re-exported from the admin typings).

## 0.0.8

### Patch Changes

- 07ff8ff: test publish npmjs from gitlab
- 2cdde0c: test deploy

## 0.0.8-alpha.1

### Patch Changes

- 2cdde0c: test deploy

## 0.0.8-alpha.0

### Patch Changes

- 07ff8ff: test publish npmjs from gitlab

## 0.0.7

### Patch Changes

- 256c4c7: chore(pkg): Update author and references in pg-toolkit

  - Update package author to 'Roy Chuang'.
  - Update organization references in documentation to 'royfw'.

- beed96d: test release

## 0.0.7-alpha.0

### Patch Changes

- beed96d: test release

## 0.0.6

### Patch Changes

- 0438374: test npm publish
- 7a03432: test publish 2\

## 0.0.6-alpha.1

### Patch Changes

- 7a03432: test publish 2\

## 0.0.6-alpha.0

### Patch Changes

- 0438374: test npm publish

## 0.0.5

### Patch Changes

- 7b78676: test publish

## 0.0.5-alpha.0

### Patch Changes

- 7b78676: test publish

## 0.0.4

### Patch Changes

- 67eb362: Refactor: enhance pg-toolkit with seed history logic, cleanup utils, and add documentation.

## 0.0.4-alpha.0

### Patch Changes

- 67eb362: Refactor: enhance pg-toolkit with seed history logic, cleanup utils, and add documentation.

## 0.0.3

### Patch Changes

- 43777d2: test publish pg-toolkit

## 0.0.2

### Patch Changes

- 047bd95: test publish package
