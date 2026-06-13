import { packageRegistry, toolRegistry, type PackageDefinition, type ToolDefinition } from "@rfjs/web-core";

// Flat sidebar sections (the old package→tool nesting + `claimed` dedupe is gone;
// a tool's package association is shown as a badge on the tools index instead).
export function sidebarPackages(): PackageDefinition[] {
  return packageRegistry;
}

export function sidebarTools(): ToolDefinition[] {
  return toolRegistry.filter((tool) => tool.surface === "web");
}
