import type { ToolDefinition } from "@rfjs/web-core";

// Workbench apps live on a separate origin (its own PWA scope); web quick tools
// are internal routes. The base is overridable per environment; dev defaults to
// the workbench dev server port.
export const workbenchUrl = process.env.NEXT_PUBLIC_WORKBENCH_URL ?? "http://localhost:3001";

export function isExternalTool(tool: ToolDefinition): boolean {
  return tool.surface === "workbench";
}

export function toolHref(tool: ToolDefinition): string {
  return isExternalTool(tool) ? `${workbenchUrl}/apps/${tool.id}` : `/tools/${tool.id}`;
}
