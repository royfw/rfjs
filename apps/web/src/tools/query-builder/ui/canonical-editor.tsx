"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
import { useEffect, useRef, useState } from "react";

// Editable view of the canonical FilterGroupLike JSON. The tree is the source of
// truth; this box reflects it only when not being edited (avoids clobbering the
// user's draft / cursor). Edits are debounced before calling onParse.
export function CanonicalEditor({
  serialized,
  errorText,
  hint,
  onParse,
}: {
  serialized: string;
  errorText: string | null;
  hint: string;
  onParse: (text: string) => void;
}) {
  const [draft, setDraft] = useState(serialized);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(serialized);
  }, [serialized, editing]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function onChange(text: string) {
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onParse(text), 300);
  }

  return (
    <Panel title={hint}>
      <textarea
        aria-label={hint}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        spellCheck={false}
        rows={12}
        className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
      />
      {errorText ? <p className="mt-1 font-mono text-sm text-fault">{errorText}</p> : null}
    </Panel>
  );
}
