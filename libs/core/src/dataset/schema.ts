import { z } from 'zod';

// NOTE: this repo is on zod v4 — z.record requires explicit key + value schemas.
export const DatasetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Dataset = z.infer<typeof DatasetSchema>;

export const CreateDatasetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetInputSchema>;
