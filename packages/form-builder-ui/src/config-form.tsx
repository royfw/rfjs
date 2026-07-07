'use client';

import * as React from 'react';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  configToZod,
  evaluateConditional,
  resolveLabel,
  normalizeToSections,
  collectFieldItems,
  isFieldItem,
  type FormConfig,
  type FormItem,
  type FieldWidth,
  type DataSource,
  type DataSourceFetcher,
  type UploadHandler,
  type SignatureTransport,
  type ButtonActionType,
  type ButtonItem,
  type LocalizedLabel,
} from '@rfjs/form-builder';
import { useDataSource } from './use-data-source';
import { useContainerBreakpoint } from './use-container-breakpoint';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';
import { FieldControl } from './field-control';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// getPath — dot-path lookup into an arbitrary (typically API response) value.
// Returns undefined as soon as it walks off the object graph.
// ---------------------------------------------------------------------------
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
}

// ---------------------------------------------------------------------------
// SubmissionMeta — shape of the meta object emitted by onPayloadChange.
// ---------------------------------------------------------------------------
export interface SubmissionMeta {
  valid: boolean;
  errors: Record<string, string>;
  visibleKeys: string[];
  schemaVersion?: number;
}

// ---------------------------------------------------------------------------
// ActionMeta — envelope emitted alongside `data` for onSubmit/onAction. Extends
// SubmissionMeta with action provenance (which button fired), the form's
// identity/custom metadata, and a timestamp.
// ---------------------------------------------------------------------------
export interface ActionMeta extends SubmissionMeta {
  /** FormConfig.id (when set). */
  formId?: string;
  /** ISO timestamp at the moment the action fired. */
  timestamp: string;
  /** Which action fired (name only for `custom`). */
  action: { type: ButtonActionType; name?: string };
  /** FormConfig.meta, passed through verbatim. */
  custom?: Record<string, unknown>;
  /** Set when an `api` action's fetcher rejected. */
  apiError?: string;
  /** metaProvider-injected runtime keys. */
  [key: string]: unknown;
}

/** Builds the meta envelope for an action. Reserved keys always win over metaProvider output. */
export function buildActionMeta(opts: {
  config: FormConfig;
  data: Record<string, unknown>;
  action: { type: ButtonActionType; name?: string };
  metaProvider?: () => Record<string, unknown>;
}): ActionMeta {
  const { config, data, action, metaProvider } = opts;
  const visibleFieldItems = collectFieldItems(config).filter((f) => evaluateConditional(f.conditional, data));
  const parsed = configToZod({ version: config.version, fields: visibleFieldItems }).safeParse(data);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (k && !errors[k]) errors[k] = issue.message;
    }
  }
  return {
    ...(metaProvider ? metaProvider() : {}),
    valid: parsed.success,
    errors,
    visibleKeys: Object.keys(data),
    schemaVersion: config.version,
    ...(config.id !== undefined ? { formId: config.id } : {}),
    timestamp: new Date().toISOString(),
    action,
    ...(config.meta !== undefined ? { custom: config.meta } : {}),
  };
}

// ---------------------------------------------------------------------------
// computePayload — pure function: strips conditionally-hidden field values
// from the raw RHF values object (same logic as the submit handler).
// ---------------------------------------------------------------------------
export function computePayload(
  values: Record<string, unknown>,
  config: FormConfig,
): Record<string, unknown> {
  const visibleKeys = new Set(
    collectFieldItems(config)
      .filter((f) => evaluateConditional(f.conditional, values))
      .map((f) => f.key),
  );
  return Object.fromEntries(Object.entries(values).filter(([k]) => visibleKeys.has(k)));
}

// Stable style constant — outside the component so it's never recreated on render.
const FULL_SPAN: React.CSSProperties = { gridColumn: '1 / -1' };

interface DataSourceContentProps {
  ds: DataSource;
  fetcher?: DataSourceFetcher;
}

function DataSourceContent({ ds, fetcher }: DataSourceContentProps) {
  const dsState = useDataSource(ds, fetcher);

  if (dsState.status === 'loading') {
    return <span className="text-muted-foreground">Loading…</span>;
  }

  if (dsState.status === 'ready') {
    const display = dsState.value != null && dsState.value !== '' ? String(dsState.value) : (ds.fallback ?? '無');
    return <span>{display}</span>;
  }

  // idle or error → fallback
  return <span>{ds.fallback ?? '無'}</span>;
}

export interface ConfigFormProps {
  /**
   * `config` drives the form reactively: changing it re-renders the field list and resets
   * the form state (clears stale values for removed/changed fields) without unmounting.
   * The zod resolver is recomputed per `config` so validation tracks the latest schema.
   */
  config: FormConfig;
  defaultValues?: Record<string, unknown>;
  onSubmit: (payload: { data: Record<string, unknown>; meta: ActionMeta }) => void;
  submitLabel?: string;
  /** BCP-47 locale used to resolve `LocalizedLabel` field labels. Defaults to `'en'`. */
  locale?: string;
  /**
   * Fetcher for `dataSource` fields (Select/Radio). Receives a `DataSourceRequest` and
   * returns the raw response. Memoize with `useCallback` to avoid unnecessary refetches.
   * When absent, dataSource fields degrade to their fallback text.
   */
  fetcher?: DataSourceFetcher;
  /**
   * Handler for `FileUpload` fields. Receives a `File` and `{ fieldKey }` context
   * and returns a `FileRef`. When absent, FileUpload fields render a disabled fallback.
   * Memoize with `useCallback` to avoid unnecessary re-renders.
   */
  uploadHandler?: UploadHandler;
  /**
   * Transport factory for `Signature` fields. Receives `{ fieldKey, signal }` and
   * returns a `SignatureCaptureHandle`. When absent, the local `<SignaturePad>`
   * drives value directly via `onChange` (no remote capture session).
   * Memoize with `useCallback` to avoid unnecessary session restarts.
   */
  signatureTransport?: SignatureTransport;
  /**
   * Called on every form value change (live, no submit required) with the current
   * payload (conditionally-hidden fields excluded) and a `SubmissionMeta` object
   * containing the zod validation result, per-field errors, visible keys, and the
   * config's schema version.
   * Only wired up (and triggers an effect) when provided.
   */
  onPayloadChange?: (p: { data: Record<string, unknown>; meta: SubmissionMeta }) => void;
  /** Supplies extra runtime keys (e.g. user/session info) merged into every `ActionMeta`. */
  metaProvider?: () => Record<string, unknown>;
  /** Called for `custom`/`api` button actions with the action name and its payload. */
  onAction?: (name: string, payload: { data: Record<string, unknown>; meta: ActionMeta; response?: unknown }) => void;
}

export function ConfigForm({ config, defaultValues, onSubmit, submitLabel = 'Submit', locale = 'en', fetcher, uploadHandler, signatureTransport, onPayloadChange, metaProvider, onAction }: ConfigFormProps) {
  // Container ref for ResizeObserver-driven responsive collapse.
  const rootRef = React.useRef<HTMLFormElement>(null);
  const stackBelow = config.responsive?.stackBelow ?? 640;
  const narrow = useContainerBreakpoint(rootRef, stackBelow);

  // Keep the latest config reachable inside the stable resolver without re-creating it.
  const configRef = React.useRef(config);
  configRef.current = config;

  // A single STABLE resolver passed once to useForm. RHF calls it at validation time with the
  // current values; it builds the zod schema over ONLY the fields visible for those values, so
  // hidden (e.g. required) fields never block submit. No private internals, no resolver swapping.
  const resolver = React.useCallback<Resolver>((values, ctx, opts) => {
    const cfg = configRef.current;
    const visibleFieldItems = collectFieldItems(cfg).filter((f) =>
      evaluateConditional(f.conditional, values as Record<string, unknown>),
    );
    // Build a minimal config with only the visible field items so configToZod validates them.
    const visibleConfig: FormConfig = { version: cfg.version, fields: visibleFieldItems };
    return zodResolver(configToZod(visibleConfig))(values, ctx, opts);
  }, []);

  const { control, handleSubmit, reset, watch, setError, trigger, getValues, setValue, formState: { errors } } = useForm({ resolver, defaultValues });

  // Track which Signature fields have an active capture in progress — used to
  // gate the submit button while a capture is pending.
  const [pendingCaptures, setPendingCaptures] = React.useState<Set<string>>(new Set());

  // api 動作狀態:同表單同時只允許一顆 in-flight。
  const [apiState, setApiState] = React.useState<{ itemId: string; status: 'pending' | 'success' | 'error' } | null>(null);

  const handleSignatureStatus = React.useCallback((fieldKey: string, status: string) => {
    setPendingCaptures((prev) => {
      const next = new Set(prev);
      if (status === 'pending') {
        next.add(fieldKey);
      } else {
        next.delete(fieldKey);
      }
      return next;
    });
  }, []);

  // Re-initialise form state when `config` changes so stale field values are cleared.
  // Also clear pendingCaptures: any Signature fields that were pending will unmount
  // and emit 'idle' via their cleanup, but resetting here is an additional safeguard
  // for in-tree fields that may not unmount (e.g. same key, changed config).
  React.useEffect(() => {
    reset(defaultValues ?? {});
    setPendingCaptures(new Set());
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to all form values to decide which items to RENDER (live show/hide).
  const values = watch();

  // Live-payload seam: compute and emit payload + meta on every value change.
  // useWatch gives a stable reference to the latest values for the effect.
  const watchedValues = useWatch({ control });
  const onPayloadChangeRef = React.useRef(onPayloadChange);
  onPayloadChangeRef.current = onPayloadChange;
  React.useEffect(() => {
    if (!onPayloadChangeRef.current) return;
    const vals = watchedValues as Record<string, unknown>;
    const data = computePayload(vals, config);
    // Build visible-only schema — mirrors the resolver so meta.valid reflects actual
    // submittability: hidden required fields are excluded, just as the resolver excludes them.
    const visibleFieldItems = collectFieldItems(config).filter((f) =>
      evaluateConditional(f.conditional, vals),
    );
    const visibleConfig: FormConfig = { version: config.version, fields: visibleFieldItems };
    const parsed = configToZod(visibleConfig).safeParse(data);
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (k && !errors[k]) errors[k] = issue.message;
      }
    }
    onPayloadChangeRef.current({
      data,
      meta: {
        valid: parsed.success,
        errors,
        visibleKeys: Object.keys(data),
        schemaVersion: config.version,
      },
    });
  }, [watchedValues, config]); // eslint-disable-line react-hooks/exhaustive-deps

  const spacerHeights: Record<string, number> = { sm: 8, md: 16, lg: 32 };

  // Span styles are applied INLINE, not via Tailwind `col-span-*` utilities —
  // those aren't reliably emitted for this package. Inline is guaranteed.
  // Items always span the full row width. (FULL_SPAN is module-level — see above.)

  // Explicit grid placement → inline grid-area style (grid-mode sections, Task 2).
  // When narrow, collapse to full width (no placement).
  const placementStyle = (p: { colStart: number; colSpan: number; row: number; rowSpan?: number }): React.CSSProperties =>
    narrow
      ? { ...FULL_SPAN, minWidth: 0 }
      : {
          gridColumn: `${p.colStart} / span ${p.colSpan}`,
          gridRow: p.rowSpan ? `${p.row} / span ${p.rowSpan}` : String(p.row),
          minWidth: 0,
        };

  // Field grid-span derived from the field's width AND the section's column count.
  // #3: columns DRIVE width — an unset width is a single cell, so a section with
  // `columns: 2` lays its fields two-per-row automatically (no per-field width
  // needed). 'half' ≈ half the row; 'full' spans the whole row. `flow: 'v1'`
  // keeps the legacy behaviour (unset = full) for back-compat with `fields[]`.
  function fieldSpanStyle(width: FieldWidth | undefined, flow: 'v1' | 'section', cols: number): React.CSSProperties {
    if (narrow) return FULL_SPAN;
    if (flow === 'v1') return { gridColumn: (width ?? 'full') === 'full' ? '1 / -1' : undefined };
    if (width === 'full') return FULL_SPAN;
    const cells = width === 'half' ? Math.max(1, Math.ceil(cols / 2)) : 1;
    const span = Math.min(cells, cols);
    return { gridColumn: `span ${span} / span ${span}`, minWidth: 0 };
  }

  const BUTTON_VARIANT: Record<NonNullable<ButtonItem['variant']>, 'default' | 'outline' | 'ghost' | 'destructive'> = {
    primary: 'default',
    outline: 'outline',
    ghost: 'ghost',
    destructive: 'destructive',
  };
  // 文字類元件 clear 後給 ""，其餘 undefined（受控 input 需要字串空值）。
  const TEXT_COMPONENTS = new Set(['Input', 'Textarea', 'Email']);

  async function runAction(item: ButtonItem) {
    const { action } = item;
    if (action.type === 'reset') {
      reset(defaultValues ?? {});
      return;
    }
    if (action.type === 'clear') {
      const byKey = new Map(collectFieldItems(config).map((f) => [f.key, f]));
      for (const key of action.fields) {
        const comp = byKey.get(key)?.component ?? 'Input';
        setValue(key, TEXT_COMPONENTS.has(comp) ? '' : undefined, { shouldDirty: true });
      }
      return;
    }
    const doValidate = item.validate ?? (action.type === 'submit');
    if (doValidate) {
      const ok = await trigger();
      if (!ok) return;   // RHF 顯示欄位錯誤，動作不發
    }
    const data = computePayload(getValues() as Record<string, unknown>, config);
    if (action.type === 'submit') {
      onSubmit({ data, meta: buildActionMeta({ config, data, action: { type: 'submit' }, metaProvider }) });
      return;
    }
    if (action.type === 'custom') {
      onAction?.(action.name, {
        data,
        meta: buildActionMeta({ config, data, action: { type: 'custom', name: action.name }, metaProvider }),
      });
      return;
    }
    if (action.type === 'api') {
      if (!fetcher || apiState?.status === 'pending') return;
      const sent = action.fields ? Object.fromEntries(Object.entries(data).filter(([k]) => action.fields!.includes(k))) : data;
      const meta = buildActionMeta({ config, data: sent, action: { type: 'api' }, metaProvider });
      setApiState({ itemId: item.id, status: 'pending' });
      try {
        const response = await fetcher({ url: action.url, method: action.method ?? 'POST', body: { data: sent, meta } });
        for (const [path, targetKey] of Object.entries(action.responseMap ?? {})) {
          const v = getPath(response, path);
          if (v !== undefined) setValue(targetKey, v, { shouldDirty: true });
        }
        setApiState({ itemId: item.id, status: 'success' });
        onAction?.('api', { data: sent, meta, response });
      } catch (err) {
        setApiState({ itemId: item.id, status: 'error' });
        onAction?.('api', { data: sent, meta: { ...meta, apiError: err instanceof Error ? err.message : String(err) }, response: undefined });
      }
    }
  }

  function renderItem(item: FormItem, flow: 'v1' | 'section', cols: number, place?: { colStart: number; colSpan: number; row: number; rowSpan?: number }) {
    const vals = values as Record<string, unknown>;

    if (item.kind === 'ai-note') {
      return null;
    }

    if (item.kind === 'divider') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return <hr key={item.id} data-item={item.id} className="w-full border-input" style={place ? placementStyle(place) : FULL_SPAN} />;
    }

    if (item.kind === 'spacer') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      const height = spacerHeights[item.size ?? 'md'];
      return <div key={item.id} data-item={item.id} style={{ ...(place ? placementStyle(place) : FULL_SPAN), height }} />;
    }

    if (item.kind === 'content') {
      if (!evaluateConditional(item.conditional, vals)) return null;
      return (
        <div key={item.id} data-item={item.id} className="text-sm" style={place ? placementStyle(place) : FULL_SPAN}>
          {item.dataSource ? (
            <DataSourceContent ds={item.dataSource} fetcher={fetcher} />
          ) : (
            resolveLabel(item.text, locale)
          )}
        </div>
      );
    }

    if (item.kind === 'button') {
      const variant = BUTTON_VARIANT[item.variant ?? (item.action.type === 'submit' ? 'primary' : 'outline')];
      const isApi = item.action.type === 'api';
      const mine = apiState?.itemId === item.id ? apiState : null;
      const pending = mine?.status === 'pending';
      const apiDisabled = isApi && (!fetcher || apiState?.status === 'pending');
      const msg =
        mine?.status === 'success' ? resolveLabel((item.action as { messages?: { success?: LocalizedLabel } }).messages?.success ?? 'Success', locale)
        : mine?.status === 'error' ? resolveLabel((item.action as { messages?: { error?: LocalizedLabel } }).messages?.error ?? 'Request failed', locale)
        : null;
      return (
        <div key={item.id} data-item={item.id} className="flex min-w-0 items-center gap-2" style={place ? placementStyle(place) : fieldSpanStyle(undefined, flow, cols)}>
          <Button
            type="button"
            variant={variant}
            disabled={pendingCaptures.size > 0 || apiDisabled}
            title={isApi && !fetcher ? 'No fetcher provided' : undefined}
            onClick={() => void runAction(item)}
          >
            {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
            {resolveLabel(item.label, locale)}
          </Button>
          {msg && <span className={`text-xs ${mine?.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{msg}</span>}
        </div>
      );
    }

    // kind === 'field'
    if (!evaluateConditional(item.conditional, vals)) return null;
    // data-width reflects the raw setting: 'auto' (cols-driven) in sections, but
    // the legacy 'full' default in v1 so existing fields[] behaviour is unchanged.
    const dataWidth = item.width ?? (flow === 'v1' ? 'full' : 'auto');
    return (
      <div
        key={item.key}
        className="flex min-w-0 flex-col gap-1.5"
        data-width={dataWidth}
        data-item={item.id}
        style={place ? placementStyle(place) : fieldSpanStyle(item.width, flow, cols)}
      >
        <Label htmlFor={item.key}>{resolveLabel(item.label, locale)}</Label>
        <Controller
          control={control}
          name={item.key}
          render={({ field: rhf }) => (
            <FieldControl
              field={item}
              value={rhf.value}
              onChange={rhf.onChange}
              fetcher={fetcher}
              locale={locale}
              uploadHandler={uploadHandler}
              signatureTransport={signatureTransport}
              onFileError={(key, message) => setError(key, { message })}
              onSignatureStatus={handleSignatureStatus}
            />
          )}
        />
        {errors[item.key]?.message && (
          <p className="text-xs text-destructive">{String(errors[item.key]?.message)}</p>
        )}
      </div>
    );
  }

  const sections = normalizeToSections(config);
  // v1 (fields[]) → flat grid (one field per implicit row); v2 (sections[]) → flex rows.
  const isV2 = config.sections !== undefined;
  // When the config declares any button item, it owns the action affordances —
  // the default gradient Submit button is suppressed in favor of configured buttons.
  const hasButtons = React.useMemo(
    () => normalizeToSections(config).some((s) => s.rows.some((r) => r.items.some((i) => i.kind === 'button'))),
    [config],
  );
  // Use the first section's columns for the overall form grid (v1 back-compat).
  const columns = config.columns ?? sections[0]?.columns ?? 1;

  // Pre-sort grid-mode section items once per config+narrow change rather than
  // on every keystroke. `watch()` causes re-renders on every field change, so
  // the sort cost is proportional to input frequency without this memo.
  const sortedGridItems = React.useMemo(() => {
    const result = new Map<string, FormItem[]>();
    for (const section of sections) {
      if (section.layout) {
        const byId = new Map(section.layout.placements.map((p) => [p.itemId, p]));
        const allItems = section.rows.flatMap((r) => r.items);
        result.set(
          section.id,
          narrow
            ? [...allItems].sort((a, b) => {
                const pa = byId.get(a.id);
                const pb = byId.get(b.id);
                return (pa?.row ?? Number.MAX_SAFE_INTEGER) - (pb?.row ?? Number.MAX_SAFE_INTEGER) || (pa?.colStart ?? Number.MAX_SAFE_INTEGER) - (pb?.colStart ?? Number.MAX_SAFE_INTEGER);
              })
            : allItems,
        );
      }
    }
    return result;
  }, [config, narrow]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit((all) => {
        const data = computePayload(all as Record<string, unknown>, config);
        onSubmit({ data, meta: buildActionMeta({ config, data, action: { type: 'submit' }, metaProvider }) });
      })}
      className="grid gap-4"
      style={{
        gridTemplateColumns: narrow ? '1fr' : 'repeat(var(--form-cols), minmax(0, 1fr))',
        ...(!narrow && { ['--form-cols' as any]: String(columns) }),
      }}
      data-columns={columns}
    >
      {sections.map((section) => {
        // Per-section column count drives the row grid (and thus field widths).
        const sectionCols = section.columns ?? 1;

        if (isV2 && section.layout) {
          const layout = section.layout;
          const byId = new Map(layout.placements.map((p) => [p.itemId, p]));
          // Sorted order is pre-computed in sortedGridItems (memoized) to avoid re-sorting
          // on every keystroke (watch() re-renders on each field change).
          const items = sortedGridItems.get(section.id) ?? section.rows.flatMap((r) => r.items);
          return (
            <React.Fragment key={section.id}>
              {section.title && (
                <h3 className="font-semibold text-sm" style={{ gridColumn: '1 / -1' }}>
                  {resolveLabel(section.title, locale)}
                </h3>
              )}
              <div
                data-testid="form-grid"
                className="grid gap-4"
                style={{
                  gridColumn: '1 / -1',
                  gridTemplateColumns: narrow ? '1fr' : `repeat(${layout.columns}, minmax(0, 1fr))`,
                }}
              >
                {items.map((item) => renderItem(item, 'section', layout.columns, byId.get(item.id)))}
              </div>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={section.id}>
            {section.title && (
              <h3 className="font-semibold text-sm" style={{ gridColumn: '1 / -1' }}>
                {resolveLabel(section.title, locale)}
              </h3>
            )}
            {section.rows.map((row) =>
              isV2 ? (
                <div
                  key={row.id}
                  data-testid="form-row"
                  className="grid gap-4"
                  style={{
                    gridColumn: '1 / -1',
                    gridTemplateColumns: narrow ? '1fr' : `repeat(${sectionCols}, minmax(0, 1fr))`,
                  }}
                >
                  {row.items.map((item) => renderItem(item, 'section', sectionCols))}
                </div>
              ) : (
                // v1 implicit section: render items FLAT into the outer grid (unchanged v1 behavior).
                <React.Fragment key={row.id}>
                  {row.items.map((item) => renderItem(item, 'v1', sectionCols))}
                </React.Fragment>
              ),
            )}
          </React.Fragment>
        );
      })}
      {!hasButtons && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Button
            type="submit"
            disabled={pendingCaptures.size > 0}
            className="self-start border-0 text-white"
            style={{ background: 'linear-gradient(180deg,#5b8cff,#4a78ee)', boxShadow: '0 6px 16px rgba(74,120,238,.3)' }}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
