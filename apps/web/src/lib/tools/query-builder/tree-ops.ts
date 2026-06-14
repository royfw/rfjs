import type { BuilderCondition, BuilderGroup, BuilderItem, LogicOp } from "./types";

type IdGen = () => string;

export function emptyGroup(id: IdGen): BuilderGroup {
  return { kind: "group", id: id(), logic: "and", children: [] };
}

function blankCondition(id: IdGen): BuilderCondition {
  return { kind: "condition", id: id(), field: "", dataType: "string", operator: "", value: "" };
}

// Append a child under the group whose id matches targetId (immutable).
function appendTo(group: BuilderGroup, targetId: string, child: BuilderItem): BuilderGroup {
  if (group.id === targetId) return { ...group, children: [...group.children, child] };
  return {
    ...group,
    children: group.children.map((c) => (c.kind === "group" ? appendTo(c, targetId, child) : c)),
  };
}

export function addCondition(group: BuilderGroup, targetId: string, id: IdGen): BuilderGroup {
  return appendTo(group, targetId, blankCondition(id));
}

export function addGroup(group: BuilderGroup, targetId: string, id: IdGen): BuilderGroup {
  return appendTo(group, targetId, emptyGroup(id));
}

export function setLogic(group: BuilderGroup, targetId: string, logic: LogicOp): BuilderGroup {
  if (group.id === targetId) return { ...group, logic };
  return {
    ...group,
    children: group.children.map((c) => (c.kind === "group" ? setLogic(c, targetId, logic) : c)),
  };
}

export function updateNode(
  group: BuilderGroup,
  targetId: string,
  patch: Partial<BuilderCondition>,
): BuilderGroup {
  return {
    ...group,
    children: group.children.map((c) => {
      if (c.kind === "group") return updateNode(c, targetId, patch);
      return c.id === targetId ? { ...c, ...patch } : c;
    }),
  };
}

export function removeNode(group: BuilderGroup, targetId: string): BuilderGroup {
  return {
    ...group,
    children: group.children
      .filter((c) => c.id !== targetId)
      .map((c) => (c.kind === "group" ? removeNode(c, targetId) : c)),
  };
}
