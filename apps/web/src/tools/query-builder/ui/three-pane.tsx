import type { ReactNode } from "react";

export function ThreePane({
  source,
  builder,
  output,
}: {
  source: ReactNode;
  builder: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className="flex flex-col gap-3">{source}</div>
      <div className="flex flex-col gap-3">{builder}</div>
      <div className="flex flex-col gap-3">{output}</div>
    </div>
  );
}
