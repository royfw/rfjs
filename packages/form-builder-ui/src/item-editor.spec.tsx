// jsdom shim: radix-ui Select uses pointer capture and scrollIntoView APIs not available in jsdom
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { ItemEditor } from './item-editor';
import type { FieldItem, ContentItem, SpacerItem, AiNoteItem, DividerItem } from '@rfjs/form-builder';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderEditor(
  item: FieldItem | ContentItem | SpacerItem | AiNoteItem | DividerItem,
  onUpdate = vi.fn(),
  onRemove = vi.fn(),
  locales = ['en'],
) {
  render(
    <DndContext>
      <SortableContext items={[item.id]}>
        <ItemEditor
          item={item}
          siblingFields={[]}
          locales={locales}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </SortableContext>
    </DndContext>,
  );
  return { onUpdate, onRemove };
}

// ---------------------------------------------------------------------------
// ContentItem editor
// ---------------------------------------------------------------------------

const contentItem: ContentItem = {
  id: 'c1',
  kind: 'content',
  text: 'Hello world',
};

describe('ItemEditor — content kind', () => {
  it('renders a text input with the current text value', () => {
    renderEditor(contentItem);
    const input = screen.getByLabelText('content text (en)');
    expect((input as HTMLInputElement).value).toBe('Hello world');
  });

  it('editing the text input calls onUpdate with updated text', () => {
    const { onUpdate } = renderEditor(contentItem);
    fireEvent.change(screen.getByLabelText('content text (en)'), {
      target: { value: 'Updated text' },
    });
    // contentItem.text is a string 'Hello world'; when edited with locale 'en',
    // setContentLocaleText converts it to a Record keyed by locale.
    expect(onUpdate).toHaveBeenCalledWith({ text: { en: 'Updated text' } });
  });

  it('renders a locked checkbox', () => {
    renderEditor(contentItem);
    expect(screen.getByRole('checkbox', { name: /locked/i })).toBeTruthy();
  });

  it('toggling the locked checkbox calls onUpdate({ locked: true })', () => {
    const { onUpdate } = renderEditor(contentItem);
    fireEvent.click(screen.getByRole('checkbox', { name: /locked/i }));
    expect(onUpdate).toHaveBeenCalledWith({ locked: true });
  });

  it('toggling locked off (when already locked) calls onUpdate({ locked: false })', () => {
    const locked: ContentItem = { ...contentItem, locked: true };
    const { onUpdate } = renderEditor(locked);
    fireEvent.click(screen.getByRole('checkbox', { name: /locked/i }));
    expect(onUpdate).toHaveBeenCalledWith({ locked: false });
  });

  it('text inputs are disabled when locked', () => {
    const locked: ContentItem = { ...contentItem, locked: true };
    renderEditor(locked);
    const input = screen.getByLabelText('content text (en)');
    expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { onRemove } = renderEditor(contentItem);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('renders per-locale text inputs when multiple locales', () => {
    const multiLocale: ContentItem = { id: 'c2', kind: 'content', text: { en: 'Hello', 'zh-TW': '你好' } };
    renderEditor(multiLocale, vi.fn(), vi.fn(), ['en', 'zh-TW']);
    expect(screen.getByLabelText('content text (en)')).toBeTruthy();
    expect(screen.getByLabelText('content text (zh-TW)')).toBeTruthy();
  });

  it('editing a per-locale text input calls onUpdate with updated text record', () => {
    const multiLocale: ContentItem = { id: 'c2', kind: 'content', text: { en: 'Hello', 'zh-TW': '你好' } };
    const { onUpdate } = renderEditor(multiLocale, vi.fn(), vi.fn(), ['en', 'zh-TW']);
    fireEvent.change(screen.getByLabelText('content text (zh-TW)'), {
      target: { value: '嗨' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ text: { en: 'Hello', 'zh-TW': '嗨' } });
  });
});

// ---------------------------------------------------------------------------
// SpacerItem editor
// ---------------------------------------------------------------------------

const spacerItem: SpacerItem = { id: 's1', kind: 'spacer', size: 'md' };

describe('ItemEditor — spacer kind', () => {
  it('renders a size select trigger showing the current size', () => {
    renderEditor(spacerItem);
    const trigger = screen.getByLabelText('spacer size');
    expect(trigger.textContent).toContain('md');
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { onRemove } = renderEditor(spacerItem);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AiNoteItem editor
// ---------------------------------------------------------------------------

const aiNoteItem: AiNoteItem = { id: 'an1', kind: 'ai-note', text: 'Some AI guidance' };

describe('ItemEditor — ai-note kind', () => {
  it('renders a textarea with the current text', () => {
    renderEditor(aiNoteItem);
    const ta = screen.getByLabelText('ai-note text');
    expect((ta as HTMLTextAreaElement).value).toBe('Some AI guidance');
  });

  it('editing the textarea calls onUpdate({ text })', () => {
    const { onUpdate } = renderEditor(aiNoteItem);
    fireEvent.change(screen.getByLabelText('ai-note text'), {
      target: { value: 'New guidance' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ text: 'New guidance' });
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { onRemove } = renderEditor(aiNoteItem);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DividerItem editor
// ---------------------------------------------------------------------------

const dividerItem: DividerItem = { id: 'd1', kind: 'divider' };

describe('ItemEditor — divider kind', () => {
  it('renders the static "Divider — no properties" text', () => {
    renderEditor(dividerItem);
    expect(screen.getByText(/Divider — no properties/i)).toBeTruthy();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { onRemove } = renderEditor(dividerItem);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FieldItem editor — aiNote sub-block
// ---------------------------------------------------------------------------

const fieldItem: FieldItem = {
  id: 'fi1',
  kind: 'field',
  key: 'name',
  label: 'Name',
  component: 'Input',
  dataType: 'string',
};

describe('ItemEditor — field kind (aiNote sub-block)', () => {
  it('renders the aiNote input for a field item', () => {
    renderEditor(fieldItem);
    expect(screen.getByLabelText('AI note for field')).toBeTruthy();
  });

  it('editing the aiNote input calls onUpdate({ aiNote })', () => {
    const { onUpdate } = renderEditor(fieldItem);
    fireEvent.change(screen.getByLabelText('AI note for field'), {
      target: { value: 'This is an AI hint' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ aiNote: 'This is an AI hint' });
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { onRemove } = renderEditor(fieldItem);
    fireEvent.click(screen.getByRole('button', { name: /remove item/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});
