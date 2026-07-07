"use client";
import * as React from "react";

import type { ButtonAction } from "@rfjs/form-builder";
import type { Card } from "../model";
import { INPUT_CLS } from "./constants";

const TYPES: ButtonAction["type"][] = ["submit", "reset", "clear", "custom", "api"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** 依 type 切換的預設 action 值(切換時舊參數不保留 —— 各型別參數互不相容)。 */
function defaultAction(type: ButtonAction["type"]): ButtonAction {
  switch (type) {
    case "submit": return { type: "submit" };
    case "reset": return { type: "reset" };
    case "clear": return { type: "clear", fields: [] };
    case "custom": return { type: "custom", name: "action-1" };
    case "api": return { type: "api", url: "" };
  }
}

export function ActionSection({
  card, onChange, siblingFields = [],
}: { card: Card; onChange: (p: Partial<Card>) => void; siblingFields?: { key: string; dataType: string }[] }) {
  const action = card.action ?? { type: "custom" as const, name: "action-1" };
  const patch = (a: ButtonAction) => onChange({ action: a });

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Action type
        <select className={INPUT_CLS} value={action.type} onChange={(e) => patch(defaultAction(e.target.value as ButtonAction["type"]))}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      {action.type === "clear" && (
        <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
          <legend>Fields to clear</legend>
          {siblingFields.map((f) => (
            <label key={f.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={f.key}
                checked={action.fields.includes(f.key)}
                onChange={(e) =>
                  patch({ type: "clear", fields: e.target.checked ? [...action.fields, f.key] : action.fields.filter((k) => k !== f.key) })
                }
              />
              <span className="font-mono">{f.key}</span>
            </label>
          ))}
        </fieldset>
      )}

      {action.type === "custom" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Event name
          <input className={`${INPUT_CLS} font-mono`} value={action.name} onChange={(e) => patch({ type: "custom", name: e.target.value })} />
        </label>
      )}

      {action.type === "api" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            URL
            <input className={`${INPUT_CLS} font-mono`} value={action.url} onChange={(e) => patch({ ...action, url: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Method
            <select className={INPUT_CLS} value={action.method ?? "POST"} onChange={(e) => patch({ ...action, method: e.target.value as (typeof METHODS)[number] })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
            <legend>Send fields (empty = all visible)</legend>
            {siblingFields.map((f) => {
              const sel = action.fields ?? [];
              return (
                <label key={f.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`send ${f.key}`}
                    checked={sel.includes(f.key)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...sel, f.key] : sel.filter((k) => k !== f.key);
                      patch({ ...action, fields: next.length ? next : undefined });
                    }}
                  />
                  <span className="font-mono">{f.key}</span>
                </label>
              );
            })}
          </fieldset>
          <ResponseMapEditor key={card.id} action={action} patch={patch} siblingFields={siblingFields} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Success message
            <input className={INPUT_CLS} value={typeof action.messages?.success === "string" ? action.messages.success : ""} onChange={(e) => patch({ ...action, messages: { ...action.messages, success: e.target.value || undefined } })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Error message
            <input className={INPUT_CLS} value={typeof action.messages?.error === "string" ? action.messages.error : ""} onChange={(e) => patch({ ...action, messages: { ...action.messages, error: e.target.value || undefined } })} />
          </label>
        </>
      )}

      {(action.type === "submit" || action.type === "custom" || action.type === "api") && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            aria-label="Validate before run"
            checked={card.validate ?? action.type === "submit"}
            onChange={(e) => onChange({ validate: e.target.checked })}
          />
          Validate before run
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Variant
        <select className={INPUT_CLS} value={card.buttonVariant ?? (action.type === "submit" ? "primary" : "outline")} onChange={(e) => onChange({ buttonVariant: e.target.value as Card["buttonVariant"] })}>
          {(["primary", "outline", "ghost", "destructive"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
    </div>
  );
}

type ResponseMapRow = { id: number; path: string; target: string };

/**
 * responseMap 的 key-value 列表編輯(path → field key)。
 *
 * Rows are kept in local state with a stable synthetic `id` so duplicate/empty
 * `path` values don't collapse into each other while typing (Object.fromEntries
 * would silently drop earlier rows sharing a path). Only entries with a
 * non-empty, de-duplicated path are serialized outward via `patch`; rows with
 * empty or duplicate paths simply stay local (unsaved) until resolved.
 */
function ResponseMapEditor({
  action, patch, siblingFields,
}: { action: Extract<ButtonAction, { type: "api" }>; patch: (a: ButtonAction) => void; siblingFields: { key: string; dataType: string }[] }) {
  const nextId = React.useRef(0);
  const makeId = () => nextId.current++;
  const [rows, setRows] = React.useState<ResponseMapRow[]>(() =>
    Object.entries(action.responseMap ?? {}).map(([path, target]) => ({ id: makeId(), path, target })),
  );

  const commit = (next: ResponseMapRow[]) => {
    setRows(next);
    const seen = new Set<string>();
    const entries: [string, string][] = [];
    for (const { path, target } of next) {
      if (!path || seen.has(path)) continue;
      seen.add(path);
      entries.push([path, target]);
    }
    patch({ ...action, responseMap: entries.length ? Object.fromEntries(entries) : undefined });
  };

  return (
    <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
      <legend>Response map (path → field)</legend>
      {rows.map((row, i) => (
        <div key={row.id} className="flex items-center gap-1">
          <input
            className={`${INPUT_CLS} min-w-0 flex-1 font-mono`}
            aria-label={`response path ${i}`}
            value={row.path}
            onChange={(e) => commit(rows.map((r) => (r.id === row.id ? { ...r, path: e.target.value } : r)))}
          />
          <span>→</span>
          <select
            className={`${INPUT_CLS} min-w-0 flex-1`}
            aria-label={`target field ${i}`}
            value={row.target}
            onChange={(e) => commit(rows.map((r) => (r.id === row.id ? { ...r, target: e.target.value } : r)))}
          >
            {siblingFields.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}
          </select>
          <button type="button" aria-label={`remove mapping ${i}`} className="text-muted-foreground hover:text-foreground" onClick={() => commit(rows.filter((r) => r.id !== row.id))}>×</button>
        </div>
      ))}
      <button
        type="button"
        className="self-start rounded-md border border-input px-2 py-1 hover:bg-accent"
        onClick={() => commit([...rows, { id: makeId(), path: "", target: siblingFields[0]?.key ?? "" }])}
        disabled={siblingFields.length === 0}
      >
        + mapping
      </button>
    </fieldset>
  );
}
