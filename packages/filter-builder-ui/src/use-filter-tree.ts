import { useState } from "react";

import { addInferredField, emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

const id = () => crypto.randomUUID();

export function useFilterTree(init?: { tree?: BuilderGroup; schema?: FieldSchema[] }): {
  tree: BuilderGroup;
  schema: FieldSchema[];
  setTree: (g: BuilderGroup) => void;
  setSchema: (s: FieldSchema[]) => void;
  createField: (path: string) => void;
} {
  const [tree, setTree] = useState<BuilderGroup>(() => init?.tree ?? emptyGroup(id));
  const [schema, setSchema] = useState<FieldSchema[]>(() => init?.schema ?? []);
  const createField = (path: string) => setSchema((s) => addInferredField(s, path));
  return { tree, schema, setTree, setSchema, createField };
}
