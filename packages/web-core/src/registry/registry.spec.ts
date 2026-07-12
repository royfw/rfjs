import { describe, expect, it } from 'vitest';

import { packageRegistry } from './packages';
import { packageDefinitionSchema, toolDefinitionSchema } from './schemas';
import { toolRegistry } from './tools';

describe('toolRegistry', () => {
  it('every entry matches the tool schema', () => {
    for (const tool of toolRegistry) {
      expect(() => toolDefinitionSchema.parse(tool)).not.toThrow();
    }
  });

  it('ids are unique', () => {
    const ids = toolRegistry.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('relatedPackages all exist in packageRegistry', () => {
    const names = new Set(packageRegistry.map((p) => p.name));
    for (const tool of toolRegistry) {
      for (const pkg of tool.relatedPackages ?? []) {
        expect(names, `${tool.id} → ${pkg}`).toContain(pkg);
      }
    }
  });

  // A shipped web tool with working code must not still read as 'planned' (the badge would lie).
  // flow-builder / bpmn-viewer are carved out — they belong to the separate BPM project and keep
  // their own status lifecycle.
  it("no built web-surface tool is left at 'planned'", () => {
    const carveOut = new Set(['flow-builder', 'bpmn-viewer']);
    const stalePlanned = toolRegistry.filter(
      (t) => t.surface === 'web' && t.status === 'planned' && !carveOut.has(t.id),
    );
    expect(stalePlanned.map((t) => t.id)).toEqual([]);
  });
});

describe('toolDefinitionSchema web-surface guard', () => {
  const base = { id: 'x', category: 'inspect', status: 'planned' } as const;

  it('rejects a web tool with no relatedPackages', () => {
    expect(() => toolDefinitionSchema.parse({ ...base, surface: 'web' })).toThrow();
  });

  it('rejects a web tool with an empty relatedPackages array', () => {
    expect(() =>
      toolDefinitionSchema.parse({ ...base, surface: 'web', relatedPackages: [] }),
    ).toThrow();
  });

  it('allows a web tool that declares a primary package', () => {
    expect(() =>
      toolDefinitionSchema.parse({ ...base, surface: 'web', relatedPackages: ['@rfjs/jwt'] }),
    ).not.toThrow();
  });

  it('allows a workbench tool with no relatedPackages', () => {
    expect(() => toolDefinitionSchema.parse({ ...base, surface: 'workbench' })).not.toThrow();
  });
});

describe('tool surfaces', () => {
  it('every tool declares a surface', () => {
    for (const tool of toolRegistry) {
      expect(['web', 'workbench'], `${tool.id} missing surface`).toContain(tool.surface);
    }
  });

  it('workbench surface holds exactly the dataset-driven apps', () => {
    const ids = toolRegistry
      .filter((t) => t.surface === 'workbench')
      .map((t) => t.id)
      .sort();
    // data-filter-builder shipped as a web tool (the per-engine scenario pilot).
    expect(ids).toEqual(['object-transformer']);
  });
});

describe('packageRegistry', () => {
  it('every entry matches the package schema', () => {
    for (const pkg of packageRegistry) {
      expect(() => packageDefinitionSchema.parse(pkg)).not.toThrow();
    }
  });

  it('names are unique', () => {
    const names = packageRegistry.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('relatedTools all exist in toolRegistry', () => {
    const ids = new Set(toolRegistry.map((t) => t.id));
    for (const pkg of packageRegistry) {
      for (const toolId of pkg.relatedTools ?? []) {
        expect(ids, `${pkg.name} → ${toolId}`).toContain(toolId);
      }
    }
  });
});
