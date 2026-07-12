"use client";

import * as React from "react";

export interface ToolIntroConcept {
  term: string;
  desc: string;
}

export interface ToolIntroLabels {
  expand: string;
  collapse: string;
  dismiss: string;
}

interface StoredState {
  open: boolean;
  dismissed: boolean;
}

/**
 * Collapsible "how does this tool work?" callout (design spec ③, V1): one summary line when
 * collapsed, a small concept grid when expanded, dismissible with the state remembered in
 * localStorage. First shared in-body explanation block in the tool suite -- keep it this light.
 */
export function ToolIntro({
  storageKey,
  question,
  tagline,
  concepts,
  labels,
  dismissible = true,
}: {
  storageKey: string;
  question: string;
  tagline?: string;
  concepts: ToolIntroConcept[];
  labels: ToolIntroLabels;
  dismissible?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const skipFirstPersistRef = React.useRef(true);

  // Restore-before-persist: read once on mount; the persist effect below skips its own mount
  // run, which is the only run that can still see the pre-restore defaults.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredState>;
        if (typeof stored.open === "boolean") setOpen(stored.open);
        if (typeof stored.dismissed === "boolean") setDismissed(stored.dismissed);
      }
    } catch {
      // corrupted storage -> defaults
    }
  }, [storageKey]);

  React.useEffect(() => {
    // The mount run always carries the pre-restore defaults (the restore effect's setState has
    // not been applied yet), so writing here would clobber the stored value for one tick — skip
    // exactly that first run. The restore's setState (or the first user action) triggers the
    // next run with correct values.
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify({ open, dismissed }));
    } catch {
      // storage unavailable (private mode) -> non-persistent but functional
    }
  }, [storageKey, open, dismissed]);

  if (dismissed) return null;

  return (
    <div className="rounded-md border border-input px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary"
        >
          i
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm"
        >
          <span className="font-medium">{question}</span>
          {tagline ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">{tagline}</span>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {open ? labels.collapse : labels.expand}
          </span>
        </button>
        {dismissible ? (
          <button
            type="button"
            aria-label={labels.dismiss}
            onClick={() => setDismissed(true)}
            className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 grid gap-2 border-t border-dashed border-input pt-2 sm:grid-cols-3">
          {concepts.map((c) => (
            <div key={c.term}>
              <p className="text-xs font-semibold text-primary">{c.term}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
