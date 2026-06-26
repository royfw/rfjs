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
      add: (field: FieldConfig, index?: number) => apply(addField(configRef.current, field, index)),
      remove: (key: string) => apply(removeField(configRef.current, key)),
      update: (key: string, patch: Partial<FieldConfig>) => apply(updateField(configRef.current, key, patch)),
      move: (from: number, to: number) => apply(moveField(configRef.current, from, to)),
      setColumns: (columns: FormConfig['columns']) => apply({ ...configRef.current, columns }),
      replace: (next: FormConfig) => apply(next),
    }),
    [apply],
  );

  return { config, ...ops };
}
