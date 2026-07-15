'use client';

import * as React from 'react';
import {
  loadDataSource,
  toOptions,
  type DataSource,
  type DataSourceFetcher,
  type FieldOption,
} from '@rfjs/form-builder';

export interface DataSourceState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  value: unknown;
  options: FieldOption[];
  error?: string;
}

const IDLE: DataSourceState = { status: 'idle', value: undefined, options: [] };

/**
 * Fetches and extracts data from a `DataSource`, converting it to `FieldOption[]`.
 *
 * Re-runs whenever `ds` or `fetcher` references change.
 * Consumers should memoize `fetcher` (e.g. `useCallback`) to avoid unnecessary refetches.
 */
export function useDataSource(
  ds: DataSource | undefined,
  fetcher?: DataSourceFetcher,
): DataSourceState {
  const [state, setState] = React.useState<DataSourceState>(IDLE);

  React.useEffect(() => {
    if (!ds || !fetcher) {
      setState(IDLE);
      return;
    }

    let active = true;
    setState({ status: 'loading', value: undefined, options: [] });

    loadDataSource(ds, fetcher)
      .then((value) => {
        if (!active) return;
        setState({ status: 'ready', value, options: toOptions(value, ds) });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ status: 'error', value: undefined, options: [], error: String(err) });
      });

    return () => {
      active = false;
    };
  }, [ds, fetcher]);

  return state;
}
