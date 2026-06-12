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

  it('ids and hrefs are unique', () => {
    const ids = toolRegistry.map((t) => t.id);
    const hrefs = toolRegistry.map((t) => t.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('relatedPackages all exist in packageRegistry', () => {
    const names = new Set(packageRegistry.map((p) => p.name));
    for (const tool of toolRegistry) {
      for (const pkg of tool.relatedPackages ?? []) {
        expect(names, `${tool.id} → ${pkg}`).toContain(pkg);
      }
    }
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
