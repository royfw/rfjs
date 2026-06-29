'use client';

import { ChevronDown, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Command, CommandGroup, CommandItem, CommandList } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  options?: { label: string; value: string }[];
  creatable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function TagInput({
  value,
  onChange,
  options,
  creatable,
  disabled,
  placeholder,
  id,
}: TagInputProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const getLabelForValue = (val: string) =>
    options?.find((opt) => opt.value === val)?.label ?? val;

  const handleSelect = (optValue: string) => {
    if (!value.includes(optValue)) {
      onChange([...value, optValue]);
    }
    setOpen(false);
  };

  const handleRemove = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && creatable) {
      const trimmed = inputValue.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue('');
      e.preventDefault();
    }
  };

  const hasOptions = Array.isArray(options) && options.length > 0;

  return (
    <div
      id={id}
      data-slot="tag-input"
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1.5',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {value.map((val) => {
        const label = getLabelForValue(val);
        return (
          <span
            key={val}
            className="inline-flex items-center gap-0.5 rounded bg-accent px-2 py-0.5 text-sm text-accent-foreground"
          >
            {label}
            <button
              type="button"
              onClick={() => handleRemove(val)}
              aria-label={`Remove ${label}`}
              disabled={disabled}
              className="ml-0.5 rounded-sm opacity-70 hover:opacity-100 focus:outline-none disabled:pointer-events-none"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}

      {creatable && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      )}

      {hasOptions && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Open tag options"
              className="ml-auto rounded-sm opacity-70 hover:opacity-100 focus:outline-none disabled:pointer-events-none"
            >
              <ChevronDown className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {options!
                    .filter((opt) => !value.includes(opt.value))
                    .map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => handleSelect(opt.value)}
                      >
                        {opt.label}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
