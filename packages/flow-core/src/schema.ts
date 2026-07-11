import { z } from "zod";

export const flowNodeTypeSchema = z.enum(["start", "end", "form", "condition", "action"]);

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: flowNodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  // 內嵌既有工具 JSON;Phase 1 以 unknown 透傳(深度驗證交給各編輯器)。
  config: z.unknown().optional(),
  // 預留(Phase 2 才執行,Phase 1 只存):
  inputs: z.array(z.string()).optional(),
  outputCollection: z.boolean().optional(),
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
  // 預留(Phase 2 navigation runtime):
  trigger: z.string().optional(),
  condition: z.unknown().optional(),
});

export const flowDocSchema = z.object({
  version: z.literal(1),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
});

export type FlowNodeType = z.infer<typeof flowNodeTypeSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowDoc = z.infer<typeof flowDocSchema>;

/** 全新流程:一顆 start 節點。 */
export const emptyFlow = (): FlowDoc => ({
  version: 1,
  nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 } }],
  edges: [],
});

export const parseFlow = (json: string): FlowDoc => flowDocSchema.parse(JSON.parse(json));

export const flowToJson = (doc: FlowDoc): string => JSON.stringify(doc, null, 2);
