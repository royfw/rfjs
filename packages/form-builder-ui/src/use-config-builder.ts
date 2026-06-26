import * as React from 'react';
import {
  addField,
  removeField,
  updateField,
  moveField,
  addItem,
  removeItem,
  updateItem,
  moveItemWithinRow,
  moveItemToRow,
  splitToNewRow,
  addSection,
  setSectionColumns,
  type FieldConfig,
  type FormConfig,
  type FormItem,
} from '@rfjs/form-builder';

export interface ConfigBuilderApi {
  config: FormConfig;
  // v1 back-compat field ops
  add: (field: FieldConfig, index?: number) => void;
  remove: (key: string) => void;
  update: (key: string, patch: Partial<FieldConfig>) => void;
  move: (from: number, to: number) => void;
  setColumns: (columns: FormConfig['columns']) => void;
  replace: (config: FormConfig) => void;
  // v2 tree-op wrappers
  addItem: (sectionId: string, rowId: string, item: FormItem, index?: number) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, patch: Partial<FormItem>) => void;
  moveItemWithinRow: (rowId: string, from: number, to: number) => void;
  moveItemToRow: (itemId: string, targetRowId: string, index?: number) => void;
  splitToNewRow: (itemId: string, sectionId: string, index?: number) => void;
  addSection: (index?: number) => void;
  setSectionColumns: (sectionId: string, columns: 1 | 2 | 3 | 4) => void;
}

export function useConfigBuilder(
  initial: FormConfig,
  onChange?: (config: FormConfig) => void,
): ConfigBuilderApi {
  const [config, setConfig] = React.useState<FormConfig>(initial);
  const configRef = React.useRef(config);
  configRef.current = config;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const apply = React.useCallback((next: FormConfig) => {
    configRef.current = next; // so back-to-back ops in one tick see the latest
    setConfig(next);
    onChangeRef.current?.(next);
  }, []);

  const ops = React.useMemo(
    () => ({
      // v1 back-compat
      add: (field: FieldConfig, index?: number) => apply(addField(configRef.current, field, index)),
      remove: (key: string) => apply(removeField(configRef.current, key)),
      update: (key: string, patch: Partial<FieldConfig>) => apply(updateField(configRef.current, key, patch)),
      move: (from: number, to: number) => apply(moveField(configRef.current, from, to)),
      setColumns: (columns: FormConfig['columns']) => apply({ ...configRef.current, columns }),
      replace: (next: FormConfig) => apply(next),
      // v2 tree-op wrappers
      addItem: (sectionId: string, rowId: string, item: FormItem, index?: number) =>
        apply(addItem(configRef.current, sectionId, rowId, item, index)),
      removeItem: (itemId: string) => apply(removeItem(configRef.current, itemId)),
      updateItem: (itemId: string, patch: Partial<FormItem>) =>
        apply(updateItem(configRef.current, itemId, patch)),
      moveItemWithinRow: (rowId: string, from: number, to: number) =>
        apply(moveItemWithinRow(configRef.current, rowId, from, to)),
      moveItemToRow: (itemId: string, targetRowId: string, index?: number) =>
        apply(moveItemToRow(configRef.current, itemId, targetRowId, index)),
      splitToNewRow: (itemId: string, sectionId: string, index?: number) =>
        apply(splitToNewRow(configRef.current, itemId, sectionId, index)),
      addSection: (index?: number) => apply(addSection(configRef.current, index)),
      setSectionColumns: (sectionId: string, columns: 1 | 2 | 3 | 4) =>
        apply(setSectionColumns(configRef.current, sectionId, columns)),
    }),
    [apply],
  );

  return { config, ...ops };
}
