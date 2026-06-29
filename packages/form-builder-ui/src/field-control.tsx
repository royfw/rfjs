'use client';

import * as React from 'react';
import type { FieldConfig, DataSourceFetcher, UploadHandler, SignatureTransport } from '@rfjs/form-builder';
import { resolveLabel } from '@rfjs/form-builder';
import { Input } from '@rfjs/web-ui/components/input';
import { Textarea } from '@rfjs/web-ui/components/textarea';
import { Checkbox } from '@rfjs/web-ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@rfjs/web-ui/components/select';
import { Switch } from '@rfjs/web-ui/components/switch';
import { RadioGroup, RadioGroupItem } from '@rfjs/web-ui/components/radio-group';
import { Label } from '@rfjs/web-ui/components/label';
import { Button } from '@rfjs/web-ui/components/button';
import { Popover, PopoverContent, PopoverTrigger } from '@rfjs/web-ui/components/popover';
import { Calendar } from '@rfjs/web-ui/components/calendar';
import { TagInput } from '@rfjs/web-ui/components/tag-input';
import { SignaturePad } from '@rfjs/web-ui/components/signature-pad';
import { useDataSource } from './use-data-source';
import { useSignatureCapture } from './use-signature-capture';

export interface FieldControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
  /** BCP-47 locale for resolving LocalizedLabel descriptions. Defaults to 'en'. */
  locale?: string;
  /**
   * Handler for FileUpload fields. Receives a `File` and returns a `FileRef`.
   * When absent, FileUpload fields render a disabled fallback.
   * Memoize with `useCallback` to avoid unnecessary re-renders.
   */
  uploadHandler?: UploadHandler;
  /**
   * Transport factory for Signature fields. Receives `{ fieldKey, signal }` and
   * returns a `SignatureCaptureHandle`. When absent, the local `<SignaturePad>`
   * drives value directly via `onChange`.
   * Memoize with `useCallback` to avoid unnecessary session restarts.
   */
  signatureTransport?: SignatureTransport;
  /**
   * Callback to report a file error message (e.g. over maxSize).
   * Used internally by ConfigForm to surface errors via RHF.
   */
  onFileError?: (key: string, message: string) => void;
  /**
   * Callback to report signature capture status changes.
   * Used by ConfigForm to gate the submit button while any capture is pending.
   */
  onSignatureStatus?: (fieldKey: string, status: string) => void;
}

/** Format a Date as a LOCAL `yyyy-mm-dd` ISO string (no UTC shift). */
export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a `yyyy-mm-dd` ISO string into a LOCAL-midnight Date (no UTC shift). */
export function isoToDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

// --- FileUpload control ---

interface FileUploadControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  uploadHandler?: UploadHandler;
  onFileError?: (key: string, message: string) => void;
}

function FileUploadControl({ field, value: _value, onChange, uploadHandler, onFileError }: FileUploadControlProps) {
  const effectiveDisabled = field.disabled || field.readOnly;

  if (!uploadHandler) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">No upload handler provided — upload unavailable</p>
        <input id={field.key} type="file" disabled aria-label={`${String(field.key)} file upload (unavailable)`} />
      </div>
    );
  }

  const { accept, multiple, maxSize } = field.fileUpload ?? {};

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const accepted: File[] = [];
    for (const file of files) {
      if (maxSize !== undefined && file.size > maxSize) {
        onFileError?.(field.key, `File "${file.name}" exceeds the maximum size of ${maxSize} bytes`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;

    try {
      const refs = await Promise.all(accepted.map((f) => uploadHandler(f, { fieldKey: field.key })));
      onChange(multiple ? refs : refs[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      onFileError?.(field.key, message);
    }
  }

  return (
    <input
      id={field.key}
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={effectiveDisabled}
      aria-readonly={field.readOnly || undefined}
      onChange={handleChange}
    />
  );
}

// --- Signature control ---

interface SignatureControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  signatureTransport?: SignatureTransport;
  onSignatureStatus?: (fieldKey: string, status: string) => void;
}

function SignatureControl({ field, value, onChange, signatureTransport, onSignatureStatus }: SignatureControlProps) {
  // Hook always called unconditionally.
  const capture = useSignatureCapture(signatureTransport, field.key);

  const effectiveDisabled = field.disabled || field.readOnly;
  const ariaReadonly = field.readOnly || undefined;

  // When transport is provided and ready, sync the capture value into RHF.
  React.useEffect(() => {
    if (capture.status === 'ready' && capture.value) {
      onChange(capture.value);
    }
  }, [capture.status, capture.value, onChange]);

  // Report status changes upward (e.g. to gate ConfigForm's submit button).
  // On unmount (e.g. field hidden by conditional or config change), emit 'idle'
  // so ConfigForm removes this key from pendingCaptures and submit is not stuck.
  React.useEffect(() => {
    onSignatureStatus?.(field.key, capture.status);
    return () => {
      onSignatureStatus?.(field.key, 'idle');
    };
  }, [field.key, capture.status, onSignatureStatus]);

  return (
    <div className="flex flex-col gap-2">
      <SignaturePad
        value={(value as string) ?? ''}
        onChange={(dataUrl) => {
          // Local pad — write directly into RHF (no transport).
          if (!signatureTransport) {
            onChange(dataUrl);
          }
        }}
        disabled={effectiveDisabled || capture.status === 'pending'}
        penColor="#000000"
        aria-readonly={ariaReadonly}
      />
      {signatureTransport && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={effectiveDisabled || capture.status === 'pending'}
            onClick={() => capture.start()}
          >
            {capture.status === 'pending' ? 'Capturing…' : 'Capture signature'}
          </Button>
          {capture.status === 'pending' && (
            <Button type="button" variant="ghost" size="sm" onClick={() => capture.cancel()}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components for controls that use hooks ---

interface SelectControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
}

function SelectControl({ field, value, onChange, fetcher }: SelectControlProps) {
  // Hook ALWAYS called unconditionally — returns idle when ds or fetcher is absent.
  const dsState = useDataSource(field.dataSource, fetcher);

  const effectiveDisabled = field.disabled || field.readOnly;
  const ariaReadonly = field.readOnly || undefined;

  if (field.dataSource) {
    if (dsState.status === 'loading') {
      return (
        <Select disabled>
          <SelectTrigger id={field.key} className="w-full">
            <SelectValue placeholder="Loading…" />
          </SelectTrigger>
          <SelectContent />
        </Select>
      );
    }
    if (dsState.status === 'ready' && dsState.options.length > 0) {
      return (
        <Select value={(value as string) ?? ''} onValueChange={onChange}>
          <SelectTrigger
            id={field.key}
            className="w-full"
            disabled={effectiveDisabled}
            aria-readonly={ariaReadonly}
          >
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {dsState.options.map((opt) => (
              <SelectItem key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    // error, idle (no fetcher), or ready with empty options → fallback
    return (
      <span className="text-sm text-muted-foreground">
        {field.dataSource.fallback ?? '無'}
      </span>
    );
  }

  // No dataSource → static options (unchanged behavior)
  return (
    <Select value={(value as string) ?? ''} onValueChange={onChange}>
      <SelectTrigger
        id={field.key}
        className="w-full"
        disabled={effectiveDisabled}
        aria-readonly={ariaReadonly}
      >
        <SelectValue placeholder={field.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(field.options ?? []).map((opt) => (
          <SelectItem key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface RadioControlProps {
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  fetcher?: DataSourceFetcher;
}

function RadioControl({ field, value, onChange, fetcher }: RadioControlProps) {
  // Hook ALWAYS called unconditionally — returns idle when ds or fetcher is absent.
  const dsState = useDataSource(field.dataSource, fetcher);

  const effectiveDisabled = field.disabled || field.readOnly;
  const ariaReadonly = field.readOnly || undefined;

  if (field.dataSource) {
    if (dsState.status === 'loading') {
      return <p className="text-sm text-muted-foreground">Loading…</p>;
    }
    if (dsState.status === 'ready' && dsState.options.length > 0) {
      return (
        <RadioGroup
          id={field.key}
          value={String(value ?? '')}
          onValueChange={onChange}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        >
          {dsState.options.map((opt) => (
            <div key={String(opt.value)} className="flex items-center gap-2">
              <RadioGroupItem
                value={String(opt.value)}
                id={`${field.key}-${opt.value}`}
              />
              <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    }
    // error, idle, or ready with empty options → fallback
    return (
      <span className="text-sm text-muted-foreground">
        {field.dataSource.fallback ?? '無'}
      </span>
    );
  }

  // No dataSource → static options (unchanged behavior)
  return (
    <RadioGroup
      id={field.key}
      value={String(value ?? '')}
      onValueChange={onChange}
      disabled={effectiveDisabled}
      aria-readonly={ariaReadonly}
    >
      {(field.options ?? []).map((opt) => (
        <div key={String(opt.value)} className="flex items-center gap-2">
          <RadioGroupItem
            value={String(opt.value)}
            id={`${field.key}-${opt.value}`}
          />
          <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

// --- Main FieldControl ---

export function FieldControl({ field, value, onChange, fetcher, locale = 'en', uploadHandler, signatureTransport, onFileError, onSignatureStatus }: FieldControlProps) {
  const disabled = field.disabled;
  const readOnly = field.readOnly;
  // Radix controls have no readOnly — treat readOnly as disabled for interaction,
  // but signal the semantic via aria-readonly so assistive tech reports it correctly.
  const effectiveDisabled = disabled || readOnly;
  const ariaReadonly = readOnly || undefined;

  let control: React.ReactNode;

  switch (field.component) {
    case 'Textarea':
      control = (
        <Textarea
          id={field.key}
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Checkbox':
      control = (
        <Checkbox
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        />
      );
      break;
    case 'Select':
      control = <SelectControl field={field} value={value} onChange={onChange} fetcher={fetcher} />;
      break;
    case 'Date':
      control = (
        <Input
          id={field.key}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Number':
      control = (
        <Input
          id={field.key}
          type="number"
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Email':
      control = (
        <Input
          id={field.key}
          type="email"
          placeholder={field.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
      break;
    case 'Switch':
      control = (
        <Switch
          id={field.key}
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(c === true)}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
        />
      );
      break;
    case 'Radio':
      control = <RadioControl field={field} value={value} onChange={onChange} fetcher={fetcher} />;
      break;
    case 'DatePicker':
      control = (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={field.key}
              variant="outline"
              disabled={effectiveDisabled}
              aria-readonly={ariaReadonly}
            >
              {(value as string) || (field.placeholder ?? 'Pick a date')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={isoToDate(value as string)}
              onSelect={(d) => onChange(d ? dateToISO(d) : '')}
            />
          </PopoverContent>
        </Popover>
      );
      break;
    case 'CheckboxGroup': {
      const arr = (value as string[]) ?? [];
      control = (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <div key={String(opt.value)} className="flex items-center gap-2">
              <Checkbox
                id={`${field.key}-${opt.value}`}
                checked={arr.includes(String(opt.value))}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    onChange([...arr, String(opt.value)]);
                  } else {
                    onChange(arr.filter((v) => v !== String(opt.value)));
                  }
                }}
                disabled={effectiveDisabled}
                aria-readonly={ariaReadonly}
              />
              <Label htmlFor={`${field.key}-${opt.value}`}>{opt.label}</Label>
            </div>
          ))}
        </div>
      );
      break;
    }
    case 'TagList':
      control = (
        <TagInput
          id={field.key}
          value={(value as string[]) ?? []}
          onChange={(next) => onChange(next)}
          options={field.options?.map((opt) => ({
            label: String(opt.label),
            value: String(opt.value),
          }))}
          creatable={field.creatable}
          disabled={effectiveDisabled}
          aria-readonly={ariaReadonly}
          placeholder={field.placeholder}
        />
      );
      break;
    case 'FileUpload':
      control = (
        <FileUploadControl
          field={field}
          value={value}
          onChange={onChange}
          uploadHandler={uploadHandler}
          onFileError={onFileError}
        />
      );
      break;
    case 'Signature':
      control = (
        <SignatureControl
          field={field}
          value={value}
          onChange={onChange}
          signatureTransport={signatureTransport}
          onSignatureStatus={onSignatureStatus}
        />
      );
      break;
    case 'Input':
    default:
      control = (
        <Input
          id={field.key}
          type={field.dataType === 'numeric' ? 'number' : 'text'}
          placeholder={field.placeholder}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          readOnly={readOnly}
        />
      );
  }

  const descText = field.description ? resolveLabel(field.description, locale) : undefined;

  return (
    <>
      {control}
      {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
    </>
  );
}
