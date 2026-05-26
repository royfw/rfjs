---
---

ci: remove duplicate version_stable job and unify release branch configs

- Remove version_stable job that was duplicated by version_release's regex matching stable
- Split version_release rules into per-branch entries with explicit CHANNEL variables
