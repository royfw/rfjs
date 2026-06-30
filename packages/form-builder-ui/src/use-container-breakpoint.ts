import * as React from "react";

export function useContainerBreakpoint(
  ref: React.RefObject<HTMLElement>,
  breakpoint: number,
): boolean {
  const [narrow, setNarrow] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      setNarrow((prev) => (prev === w < breakpoint ? prev : w < breakpoint));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, breakpoint]);

  return narrow;
}
