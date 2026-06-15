#!/usr/bin/env node
// Root `dev` wrapper.
//
// Bare `pnpm dev` should start only the app dev servers (apps/*) — running every
// package's watcher at once trips the inotify watch limit and is rarely wanted.
// But a hard-coded `turbo dev --filter=./apps/*` cannot be narrowed: turbo merges
// multiple `--filter` flags as a UNION, and pnpm appends post-script args, so
// `pnpm dev -F web` would expand to `--filter=./apps/* -F web` = all apps again.
//
// So: default to the apps filter only when the caller passed no filter of their
// own. With an explicit -F/--filter we step aside and let turbo scope it.
//   pnpm dev            -> turbo dev --concurrency=22 --filter=./apps/*
//   pnpm dev -F web     -> turbo dev --concurrency=22 -F web
import { spawn } from "node:child_process";

const passthrough = process.argv.slice(2);
const hasFilter = passthrough.some(
  (arg) =>
    arg === "-F" ||
    arg === "--filter" ||
    arg.startsWith("-F") ||
    arg.startsWith("--filter="),
);

const scope = hasFilter ? [] : ["--filter=./apps/*"];
const args = ["dev", "--concurrency=22", ...scope, ...passthrough];

const child = spawn("turbo", args, { stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
