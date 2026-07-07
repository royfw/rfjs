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
          <ResponseMapEditor action={action} patch={patch} siblingFields={siblingFields} />
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

/** responseMap 的 key-value 列表編輯(path → field key)。 */
function ResponseMapEditor({
  action, patch, siblingFields,
}: { action: Extract<ButtonAction, { type: "api" }>; patch: (a: ButtonAction) => void; siblingFields: { key: string; dataType: string }[] }) {
  const entries = Object.entries(action.responseMap ?? {});
  const write = (next: [string, string][]) =>
    patch({ ...action, responseMap: next.length ? Object.fromEntries(next) : undefined });
  return (
    <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
      <legend>Response map (path → field)</legend>
      {entries.map(([path, target], i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={`${INPUT_CLS} min-w-0 flex-1 font-mono`} aria-label={`response path ${i}`} value={path} onChange={(e) => write(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)) as [string, string][])} />
          <span>→</span>
          <select className={`${INPUT_CLS} min-w-0 flex-1`} aria-label={`target field ${i}`} value={target} onChange={(e) => write(entries.map((en, j) => (j === i ? [en[0], e.target.value] : en)) as [string, string][])}>
            {siblingFields.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}
          </select>
          <button type="button" aria-label={`remove mapping ${i}`} className="text-muted-foreground hover:text-foreground" onClick={() => write(entries.filter((_, j) => j !== i) as [string, string][])}>×</button>
        </div>
      ))}
      <button
        type="button"
        className="self-start rounded-md border border-input px-2 py-1 hover:bg-accent"
        onClick={() => write([...entries, ["", siblingFields[0]?.key ?? ""]] as [string, string][])}
        disabled={siblingFields.length === 0}
      >
        + mapping
      </button>
    </fieldset>
  );
}
