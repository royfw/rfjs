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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4">{source}</div>
      <div className="flex flex-col gap-4">{builder}</div>
      <div className="flex flex-col gap-4">{output}</div>
    </div>
  );
}
