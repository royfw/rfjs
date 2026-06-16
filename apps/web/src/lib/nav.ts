import { packageRegistry, toolRegistry, type PackageDefinition, type ToolDefinition } from "@rfjs/web-core";

export type SidebarToolGroup = {
  pkg: PackageDefinition;
  tools: ToolDefinition[];
};

// Sidebar tree: each @rfjs package that has at least one web tool becomes a
// group, keyed by the tool's primary package (relatedPackages[0]). Group order
// follows packageRegistry (curated); tool order within a group follows
// toolRegistry. Packages with no web tool are omitted (reachable via /packages).
export function sidebarToolGroups(): SidebarToolGroup[] {
  const webTools = toolRegistry.filter((tool) => tool.surface === "web");

  return packageRegistry
    .map((pkg) => ({
      pkg,
      tools: webTools.filter((tool) => tool.relatedPackages?.[0] === pkg.name),
    }))
    .filter((group) => group.tools.length > 0);
}
