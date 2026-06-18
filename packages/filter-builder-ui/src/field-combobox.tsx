"use client";

import { useState } from "react";

import { Button } from "@rfjs/web-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@rfjs/web-ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@rfjs/web-ui/components/popover";
import { ChevronsUpDown } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  function commit(path: string) {
    onCommit(path.trim());
    setSearch("");
    setOpen(false);
  }

  const query = search.trim();
  const showCreate = query !== "" && !options.includes(query);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          variant="outline"
          size="sm"
          className="min-w-[10rem] flex-1 justify-between font-normal"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>
            {value || ariaLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder={ariaLabel} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                // commit the closure value, not cmdk's onSelect arg (it lowercases)
                <CommandItem key={o} value={o} onSelect={() => commit(o)}>
                  {o}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem value={query} onSelect={() => commit(query)} className="text-intake">
                  + {query}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
