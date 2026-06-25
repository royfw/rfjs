import * as React from 'react';
import {
  addField,
  removeField,
  updateField,
  moveField,
  type FieldConfig,
  type FormConfig,
} from '@rfjs/form-builder';

export interface ConfigBuilderApi {
  config: FormConfig;
  add: (field: FieldConfig, index?: number) => void;
  remove: (key: string) => void;
  update: (key: string, patch: Partial<FieldConfig>) => void;
  move: (from: number, to: number) => void;
  setColumns: (columns: FormConfig['columns']) => void;
  replace: (config: FormConfig) => void;
}

export function useConfigBuilder(
  initial: FormConfig,
  onChange?: (config: FormConfig) => void,
): ConfigBuilderApi {
  const [config, setConfig] = React.useState<FormConfig>(initial);

  const apply = React.useCallback(
    (next: FormConfig) => {
      setConfig(next);
      onChange?.(next);
    },
    [onChange],
  );

  return React.useMemo<ConfigBuilderApi>(
    () => ({
      config,
      add: (field, index) => apply(addField(config, field, index)),
      remove: (key) => apply(removeField(config, key)),
      update: (key, patch) => apply(updateField(config, key, patch)),
      move: (from, to) => apply(moveField(config, from, to)),
      setColumns: (columns) => apply({ ...config, columns }),
      replace: (next) => apply(next),
    }),
    [config, apply],
  );
}
