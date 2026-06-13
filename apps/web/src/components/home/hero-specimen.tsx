import { Seam } from "@rfjs/web-ui/components/seam";

const INPUT = `{
  "user": {
    "name": "Ada",
    "roles": ["admin", "dev"]
  },
  "active": true
}`;

const OUTPUT = `{
  "user.name": "Ada",
  "user.roles.0": "admin",
  "user.roles.1": "dev",
  "active": true
}`;

interface SpecimenPaneProps {
  tone: "intake" | "yield";
  /** Reading-order marker: input is the "before", output the "after". */
  direction: "before" | "after";
  label: string;
  code: string;
  /** Mono status-bar microcopy — the bench's instrument detail. */
  status: string;
}

function SpecimenPane({ tone, direction, label, code, status }: SpecimenPaneProps) {
  const isIntake = tone === "intake";
  return (
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-slab">
      {/* 1px directional accent rule — solid, not a gradient (the Seam is the only gradient). */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-px ${isIntake ? "bg-intake" : "bg-yield"}`}
      />
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span
          className={`font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${
            isIntake ? "text-intake" : "text-yield"
          }`}
        >
          {direction === "before" ? `${label} ▸` : `▸ ${label}`}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          json
        </span>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-signal">
        {code}
      </pre>
      <div className="mt-auto flex items-center gap-2 border-t border-border px-3 py-1.5">
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${isIntake ? "bg-intake" : "bg-yield"}`}
        />
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{status}</span>
      </div>
    </div>
  );
}

export function HeroSpecimen() {
  return (
    <figure className="flex flex-col gap-0">
      <div className="flex flex-col items-stretch gap-3 lg:flex-row">
        <SpecimenPane
          tone="intake"
          direction="before"
          label="input"
          code={INPUT}
          status="4 nested keys"
        />
        <div className="flex shrink-0 items-center justify-center py-1 lg:px-1 lg:py-0">
          <Seam
            state="current"
            operation="flatten()"
            orientation="horizontal"
            className="lg:hidden"
          />
          <Seam
            state="current"
            operation="flatten()"
            orientation="vertical"
            className="hidden lg:flex"
          />
        </div>
        <SpecimenPane
          tone="yield"
          direction="after"
          label="output"
          code={OUTPUT}
          status="4 flat keys"
        />
      </div>
      <figcaption className="mt-3 font-mono text-[11px] text-muted-foreground">
        <span className="text-intake">input</span> {"→"}{" "}
        <span className="text-foreground">flatten()</span> {"→"}{" "}
        <span className="text-yield">output</span> — a static specimen of{" "}
        <span className="text-foreground">@rfjs/object-utils</span>.
      </figcaption>
    </figure>
  );
}
