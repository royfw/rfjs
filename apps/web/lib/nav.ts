import { packageRegistry, toolRegistry, type ToolDefinition } from "@rfjs/web-core";

export interface SidebarGroup {
  packageName: string;
  href: string;
  tools: ToolDefinition[];
}

export function buildSidebarNav(): SidebarGroup[] {
  // Each tool belongs to a single sidebar group: its first related package in
  // registry order. Tools related to multiple packages (e.g. object-transformer)
  // are therefore listed once, not duplicated across groups.
  const claimed = new Set<string>();
  return packageRegistry
    .map((pkg) => {
      const tools = toolRegistry.filter(
        (t) => t.relatedPackages?.includes(pkg.name) && !claimed.has(t.id),
      );
      for (const tool of tools) claimed.add(tool.id);
      return { packageName: pkg.name, href: pkg.href, tools };
    })
    .filter((group) => group.tools.length > 0);
}
