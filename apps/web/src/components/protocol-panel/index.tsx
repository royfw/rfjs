"use client";

import * as React from "react";

import { Switch } from "@rfjs/web-ui/components/switch";
import { buildRequestParams, extractRows } from "@rfjs/data-schema";
import type { FilterRequestMeta, PaginationMeta, RequestMeta, ResponseMeta, SortMeta } from "@rfjs/data-schema";
import { makeHttpFetcher } from "@rfjs/table-builder-ui";

export interface ProtocolPanelLabels {
  enabled: string;
  endpoint: string;
  method: string;
  pagination: string;
  sort: string;
  sortNone: string;
  filter: string;
  filterNone: string;
  filterParam: string;
  rowsPath: string;
  totalPath: string;
  cursorPath: string;
  limitParam: string;
  offsetParam: string;
  pageParam: string;
  pageSizeParam: string;
  firstPage: string;
  cursorParam: string;
  sortParam: string;
  encoding: string;
  fieldParam: string;
  dirParam: string;
  try: string;
  tryRows: string;
  tryError: string;
}

const DEFAULT_REQUEST: RequestMeta = {
  endpoint: "/api/query/sample",
  method: "GET",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
};
const DEFAULT_RESPONSE: ResponseMeta = { rowsPath: "data.items", totalPath: "data.total" };

function paginationDefaults(strategy: PaginationMeta["strategy"]): PaginationMeta {
  switch (strategy) {
    case "offset":
      return { strategy: "offset", limitParam: "limit", offsetParam: "offset" };
    case "page":
      return { strategy: "page", pageParam: "page", pageSizeParam: "pageSize" };
    case "cursor":
      return { strategy: "cursor", cursorParam: "cursor", limitParam: "limit" };
  }
}

const inputClass = "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs";

function Seg({ options, value, onSelect }: { options: { value: string; label: string }[]; value: string; onSelect: (v: string) => void }) {
  return (
    <div className="inline-flex gap-0.5 rounded-md border border-input bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onSelect(opt.value)}
          className={`rounded px-2 py-1 text-xs ${value === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LabeledText({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={className ?? `${inputClass} w-28 font-mono`}
    />
  );
}

export function ProtocolPanel({
  request,
  response,
  onChange,
  labels,
  showEnableToggle = true,
}: {
  request: RequestMeta | undefined;
  response: ResponseMeta | undefined;
  onChange: (next: { request: RequestMeta | undefined; response: ResponseMeta | undefined }) => void;
  labels: ProtocolPanelLabels;
  showEnableToggle?: boolean;
}) {
  const enabled = request !== undefined && response !== undefined;
  const showFields = showEnableToggle ? enabled : request !== undefined && response !== undefined;

  const [trying, setTrying] = React.useState(false);
  const [tryOut, setTryOut] = React.useState<{ rows: number; raw: string } | null>(null);
  const [tryErr, setTryErr] = React.useState<string | null>(null);

  async function runTry() {
    if (!request || !response) return;
    setTrying(true);
    setTryOut(null);
    setTryErr(null);
    try {
      const built = buildRequestParams(request, { pageSize: 10 });
      const out = await makeHttpFetcher(request)(built);
      setTryOut({ rows: extractRows(out, response).length, raw: JSON.stringify(out, null, 2) });
    } catch (e) {
      setTryErr(e instanceof Error ? e.message : labels.tryError);
    } finally {
      setTrying(false);
    }
  }

  function handleToggle(checked: boolean) {
    if (!checked) {
      onChange({ request: undefined, response: undefined });
      return;
    }
    onChange({
      request: request ?? DEFAULT_REQUEST,
      response: response ?? DEFAULT_RESPONSE,
    });
  }

  function patchRequest(partial: Partial<RequestMeta>) {
    if (!request) return;
    onChange({ request: { ...request, ...partial }, response });
  }

  function patchResponse(partial: Partial<ResponseMeta>) {
    if (!response) return;
    onChange({ request, response: { ...response, ...partial } });
  }

  return (
    <div className="flex flex-col gap-3">
      {showEnableToggle && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={handleToggle} aria-label={labels.enabled} />
          {labels.enabled}
        </label>
      )}

      {showFields && request && response && (
        <div className="grid max-w-[640px] grid-cols-[140px_1fr] items-center gap-x-3 gap-y-2 text-xs">
          <span className="text-muted-foreground">{labels.endpoint}</span>
          <LabeledText label={labels.endpoint} value={request.endpoint} onChange={(v) => patchRequest({ endpoint: v })} className={`${inputClass} w-64 font-mono`} />

          <span className="text-muted-foreground">{labels.method}</span>
          <Seg
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
            ]}
            value={request.method ?? "GET"}
            onSelect={(v) => patchRequest({ method: v as "GET" | "POST" })}
          />

          <span className="text-muted-foreground">{labels.pagination}</span>
          <Seg
            options={[
              { value: "offset", label: "offset" },
              { value: "page", label: "page" },
              { value: "cursor", label: "cursor" },
            ]}
            value={request.pagination.strategy}
            onSelect={(v) => patchRequest({ pagination: paginationDefaults(v as PaginationMeta["strategy"]) })}
          />

          <span className="text-muted-foreground">└ params</span>
          <div className="flex items-center gap-2">
            {request.pagination.strategy === "offset" && (
              <>
                <LabeledText label={labels.limitParam} value={request.pagination.limitParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, limitParam: v } as PaginationMeta })} />
                <LabeledText label={labels.offsetParam} value={request.pagination.offsetParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, offsetParam: v } as PaginationMeta })} />
              </>
            )}
            {request.pagination.strategy === "page" && (
              <>
                <LabeledText label={labels.pageParam} value={request.pagination.pageParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, pageParam: v } as PaginationMeta })} />
                <LabeledText label={labels.pageSizeParam} value={request.pagination.pageSizeParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, pageSizeParam: v } as PaginationMeta })} />
                <select
                  value={request.pagination.firstPage ?? ""}
                  onChange={(e) =>
                    patchRequest({
                      pagination: {
                        ...request.pagination,
                        firstPage: e.target.value === "" ? undefined : (Number(e.target.value) as 0 | 1),
                      } as PaginationMeta,
                    })
                  }
                  aria-label={labels.firstPage}
                  className={inputClass}
                >
                  <option value="">{labels.firstPage}</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                </select>
              </>
            )}
            {request.pagination.strategy === "cursor" && (
              <>
                <LabeledText label={labels.cursorParam} value={request.pagination.cursorParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, cursorParam: v } as PaginationMeta })} />
                <LabeledText label={labels.limitParam} value={request.pagination.limitParam} onChange={(v) => patchRequest({ pagination: { ...request.pagination, limitParam: v } as PaginationMeta })} />
              </>
            )}
          </div>

          <span className="text-muted-foreground">{labels.sort}</span>
          <Seg
            options={[
              { value: "none", label: labels.sortNone },
              { value: "single", label: "single" },
              { value: "split", label: "split" },
            ]}
            value={request.sort?.style ?? "none"}
            onSelect={(v) => {
              if (v === "none") {
                const rest: RequestMeta = { ...request };
                delete rest.sort;
                onChange({ request: rest, response });
                return;
              }
              const sort: SortMeta =
                v === "single" ? { style: "single", param: "sort", encoding: "colon" } : { style: "split", fieldParam: "sortBy", dirParam: "order" };
              patchRequest({ sort });
            }}
          />

          {request.sort?.style === "single" && (
            <>
              <span className="text-muted-foreground">└ {labels.sortParam} / {labels.encoding}</span>
              <div className="flex items-center gap-2">
                <LabeledText
                  label={labels.sortParam}
                  value={request.sort.param}
                  onChange={(v) => patchRequest({ sort: { ...(request.sort as Extract<SortMeta, { style: "single" }>), param: v } })}
                />
                <Seg
                  options={[
                    { value: "colon", label: "colon" },
                    { value: "signed", label: "signed" },
                  ]}
                  value={request.sort.encoding}
                  onSelect={(v) => patchRequest({ sort: { ...(request.sort as Extract<SortMeta, { style: "single" }>), encoding: v as "colon" | "signed" } })}
                />
              </div>
            </>
          )}

          {request.sort?.style === "split" && (
            <>
              <span className="text-muted-foreground">└ {labels.fieldParam} / {labels.dirParam}</span>
              <div className="flex items-center gap-2">
                <LabeledText
                  label={labels.fieldParam}
                  value={request.sort.fieldParam}
                  onChange={(v) => patchRequest({ sort: { ...(request.sort as Extract<SortMeta, { style: "split" }>), fieldParam: v } })}
                />
                <LabeledText
                  label={labels.dirParam}
                  value={request.sort.dirParam}
                  onChange={(v) => patchRequest({ sort: { ...(request.sort as Extract<SortMeta, { style: "split" }>), dirParam: v } })}
                />
              </div>
            </>
          )}

          <span className="text-muted-foreground">{labels.filter}</span>
          <Seg
            options={[
              { value: "none", label: labels.filterNone },
              { value: "pg", label: "pg" },
            ]}
            value={request.filter?.style ?? "none"}
            onSelect={(v) => {
              if (v === "none") {
                const rest: RequestMeta = { ...request };
                delete rest.filter;
                onChange({ request: rest, response });
                return;
              }
              const filter: FilterRequestMeta = { style: "pg", param: "filter" };
              patchRequest({ filter });
            }}
          />

          {request.filter && (
            <>
              <span className="text-muted-foreground">└ {labels.filterParam}</span>
              <LabeledText label={labels.filterParam} value={request.filter.param} onChange={(v) => patchRequest({ filter: { ...(request.filter as FilterRequestMeta), param: v } })} />
            </>
          )}

          <span className="text-muted-foreground">{labels.rowsPath}</span>
          <LabeledText label={labels.rowsPath} value={response.rowsPath} onChange={(v) => patchResponse({ rowsPath: v })} className={`${inputClass} w-48 font-mono`} />

          <span className="text-muted-foreground">
            {labels.totalPath} / {labels.cursorPath}
          </span>
          <div className="flex items-center gap-2">
            <LabeledText
              label={labels.totalPath}
              value={response.totalPath ?? ""}
              onChange={(v) => patchResponse({ totalPath: v === "" ? undefined : v })}
            />
            <LabeledText
              label={labels.cursorPath}
              value={response.cursorPath ?? ""}
              onChange={(v) => patchResponse({ cursorPath: v === "" ? undefined : v })}
            />
          </div>

          <div className="col-span-2 mt-1 flex flex-col gap-1">
            <button
              type="button"
              disabled={trying}
              onClick={runTry}
              className="w-fit rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {labels.try}
            </button>
            {tryErr && <span className="text-xs text-destructive">{tryErr}</span>}
            {tryOut && (
              <>
                <span className="text-xs text-muted-foreground">{labels.tryRows.replace("{count}", String(tryOut.rows))}</span>
                <pre className="max-h-40 overflow-auto rounded-md border border-input bg-muted/30 p-2 font-mono text-[11px]">{tryOut.raw}</pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
