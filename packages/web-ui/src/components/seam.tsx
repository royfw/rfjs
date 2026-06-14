import { cn } from '../lib/utils';

export type SeamState = 'current' | 'stale' | 'running' | 'error';

export interface SeamProps {
  state: SeamState;
  operation: string;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

const lineByState: Record<SeamState, string> = {
  current: 'border-solid opacity-100',
  stale: 'border-dashed opacity-70',
  running: 'border-solid opacity-100 motion-safe:animate-pulse',
  error: 'border-dotted opacity-80',
};

export function Seam({
  state,
  operation,
  orientation = 'vertical',
  className,
}: SeamProps) {
  const isError = state === 'error';
  return (
    <div
      data-state={state}
      className={cn(
        'relative flex items-center justify-center',
        orientation === 'vertical' ? 'h-full w-px flex-col' : 'h-px w-full flex-row',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 border-0 bg-gradient-to-b from-intake to-yield',
          orientation === 'vertical' ? 'w-px border-l' : 'h-px border-t bg-gradient-to-r',
          lineByState[state],
        )}
      />
      <span
        className={cn(
          'relative z-10 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-none',
          isError
            ? 'border-dashed border-fault bg-bedrock text-fault'
            : 'border-border bg-slab text-signal/65',
        )}
      >
        {isError ? 'ERR' : `▸ ${operation}`}
      </span>
    </div>
  );
}
