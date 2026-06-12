import { z } from 'zod';

export const toolCategorySchema = z.enum([
  'format',
  'transform',
  'query',
  'filter',
  'inspect',
  'generator',
]);

export const registryStatusSchema = z.enum(['ready', 'preview', 'planned']);

export const toolSurfaceSchema = z.enum(['web', 'workbench']);

export const toolDefinitionSchema = z.object({
  id: z.string().min(1),
  category: toolCategorySchema,
  surface: toolSurfaceSchema,
  href: z.string().startsWith('/'),
  status: registryStatusSchema,
  relatedPackages: z.array(z.string().startsWith('@rfjs/')).optional(),
  tags: z.array(z.string()).optional(),
});

export const packageDefinitionSchema = z.object({
  name: z.string().startsWith('@rfjs/'),
  status: registryStatusSchema,
  href: z.string().startsWith('/'),
  npm: z.url().optional(),
  github: z.url().optional(),
  tags: z.array(z.string()).optional(),
  relatedTools: z.array(z.string()).optional(),
});

export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type RegistryStatus = z.infer<typeof registryStatusSchema>;
export type ToolSurface = z.infer<typeof toolSurfaceSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type PackageDefinition = z.infer<typeof packageDefinitionSchema>;
