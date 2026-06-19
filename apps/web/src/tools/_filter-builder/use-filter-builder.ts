"use client";

import {
  addInferredField,
  emptyGroup,
  filterGroupToTree,
  mergeFieldsFromTree,
  parseFilterGroup,
  treeToFilterGroup,
  type BuilderGroup,
  type CompileContext,
  type FieldKind,
  type FieldSchema,
  type ReverseError,
} from "@rfjs/filter-builder";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { parseCsv, parseRows, safeInfer } from "./csv";

const id = () => crypto.randomUUID();

export interface FilterBuilderState {
  sampleText: string;
  sampleOpen: boolean;
  setSampleOpen: Dispatch<SetStateAction<boolean>>;
  schema: FieldSchema[];
  setSchema: Dispatch<SetStateAction<FieldSchema[]>>;
  error: string | null;
  tree: BuilderGroup;
  setTree: (g: BuilderGroup) => void;
  rows: unknown[];
  canonicalJson: string;
  reverseError: ReverseError | null;
  onSample: (text: string) => void;
  onUpload: (file: File | undefined) => Promise<void>;
  onCanonicalChange: (text: string) => void;
  onCreateField: (path: string) => void;
}

export function useFilterBuilder({
  sample,
  deriveKind,
}: {
  sample: string;
  /** Optional per-field kind override applied on inference (e.g. pg-filter marks
   * top-level scalars as `column`). Omitted → inferred kind (`jsonb`) is kept. */
  deriveKind?: (f: FieldSchema) => FieldKind;
}): FilterBuilderState {
  function applyKind(list: FieldSchema[]): FieldSchema[] {
    return deriveKind ? list.map((f) => ({ ...f, kind: deriveKind(f) })) : list;
  }

  const [sampleText, setSampleText] = useState(sample);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [schema, setSchema] = useState<FieldSchema[]>(() => applyKind(safeInfer(sample).schema));
  const [error, setError] = useState<string | null>(() => safeInfer(sample).error);
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));

  // Canonical JSON editor state: the tree is the source of truth; the draft only
  // shadows it while the user is actively editing (avoids clobbering the cursor).
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<ReverseError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const canonical = useMemo(() => JSON.stringify(treeToFilterGroup(tree), null, 2), [tree]);

  function onCanonicalChange(text: string) {
    setJsonDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (text.trim() === "") {
        setReverseError(null);
        return;
      }
      const r = parseFilterGroup(text);
      if (r.ok) {
        setTree(filterGroupToTree(r.group, id));
        setSchema((s) => mergeFieldsFromTree(s, r.group));
        setReverseError(null);
        setJsonDraft(null); // tree now authoritative again
      } else {
        setReverseError(r.error);
      }
    }, 300);
  }

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(applyKind(next));
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    // CSV is converted to the JSON array the tool works in; JSON is used as-is.
    const json = file.name.toLowerCase().endsWith(".csv")
      ? JSON.stringify(parseCsv(text), null, 2)
      : text;
    onSample(json);
  }

  function onCreateField(path: string) {
    setSchema((s) => addInferredField(s, path));
  }

  return {
    sampleText,
    sampleOpen,
    setSampleOpen,
    schema,
    setSchema,
    error,
    tree,
    setTree,
    rows,
    canonicalJson: jsonDraft ?? canonical,
    reverseError,
    onSample,
    onUpload,
    onCanonicalChange,
    onCreateField,
  };
}

// Build a compile context from the schema (every field becomes a compile field,
// so engine compilers can resolve any referenced path).
export function toCompileContext(schema: FieldSchema[]): CompileContext {
  return {
    fields: schema.map((f) => ({
      path: f.path,
      kind: f.kind,
      dataType: f.dataType,
      elementType: f.elementType,
    })),
  };
}
