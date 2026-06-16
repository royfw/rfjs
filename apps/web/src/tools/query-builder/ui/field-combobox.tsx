"use client";

let nextId = 0;

export function FieldCombobox({
  value,
  options,
  ariaLabel,
  onCommit,
}: {
  value: string;
  options: string[];
  ariaLabel: string;
  onCommit: (path: string) => void;
}) {
  const listId = `fields-${(nextId += 1)}`;
  return (
    <>
      <input
        aria-label={ariaLabel}
        list={listId}
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
