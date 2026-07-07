import type { FlowDoc, FlowNode, FlowNodeType } from "./schema";

/** XML 屬性/文字轉義(& 必須最先換)。 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * raw id → 合法 NCName 的穩定對映:`<prefix>_<sanitized>`(前綴保證開頭合法),
 * 非 [A-Za-z0-9_.-] 一律換 `_`;sanitize 後撞名附 `_2`、`_3`…。
 */
export function makeIdMapper(prefix: string): (raw: string) => string {
  const byRaw = new Map<string, string>();
  const used = new Set<string>();
  return (raw: string): string => {
    const hit = byRaw.get(raw);
    if (hit !== undefined) return hit;
    const base = `${prefix}_${raw.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}_${n}`;
    byRaw.set(raw, id);
    used.add(id);
    return id;
  };
}

// React Flow 畫布上的節點佔位(對齊 sample.ts 的座標假設)。
const RF_W = 150;
const RF_H: Record<FlowNodeType, number> = { start: 46, end: 46, condition: 46, form: 62, action: 62 };

// BPMN 慣例尺寸:event 36×36、gateway 50×50、task 150×62,以 RF 佔位中心對齊。
const BPMN_SIZE: Record<FlowNodeType, { w: number; h: number }> = {
  start: { w: 36, h: 36 },
  end: { w: 36, h: 36 },
  condition: { w: 50, h: 50 },
  form: { w: 150, h: 62 },
  action: { w: 150, h: 62 },
};

const BPMN_ELEMENT: Record<FlowNodeType, string> = {
  start: "startEvent",
  end: "endEvent",
  form: "userTask",
  condition: "exclusiveGateway",
  action: "serviceTask",
};

// BPMN name 是匯出物、非 UI 文案 → 維持英文常數,不吃 i18n(純函式不依賴 locale)。
function nodeName(node: FlowNode): string {
  if (node.type === "action") {
    const kind = (node.config as { kind?: string } | undefined)?.kind;
    return kind ? `Action: ${kind}` : "Action";
  }
  const names: Record<Exclude<FlowNodeType, "action">, string> = {
    start: "Start",
    end: "End",
    form: "Form",
    condition: "Condition",
  };
  return names[node.type];
}

function nodeBounds(node: FlowNode): { x: number; y: number; w: number; h: number } {
  const { w, h } = BPMN_SIZE[node.type];
  const cx = node.position.x + RF_W / 2;
  const cy = node.position.y + RF_H[node.type] / 2;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}

/** FlowDoc → BPMN 2.0 XML(單向編譯;形狀比照 bpmn-viewer/samples.ts 的合法樣本)。 */
export function compileToBpmn(doc: FlowDoc): string {
  const nodeId = makeIdMapper("Node");
  const flowId = makeIdMapper("Flow");
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  // 孤兒引用防護:source/target 不存在的邊跳過,保證 id 引用永遠完整。
  const edges = doc.edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target));

  const processEls = doc.nodes.map((n) => {
    const el = BPMN_ELEMENT[n.type];
    const refs = [
      ...edges.filter((e) => e.target === n.id).map((e) => `<bpmn:incoming>${flowId(e.id)}</bpmn:incoming>`),
      ...edges.filter((e) => e.source === n.id).map((e) => `<bpmn:outgoing>${flowId(e.id)}</bpmn:outgoing>`),
    ].join("");
    return `<bpmn:${el} id="${nodeId(n.id)}" name="${escapeXml(nodeName(n))}">${refs}</bpmn:${el}>`;
  });

  const flowEls = edges.map((e) => {
    const name = e.label ? ` name="${escapeXml(e.label)}"` : "";
    return `<bpmn:sequenceFlow id="${flowId(e.id)}"${name} sourceRef="${nodeId(e.source)}" targetRef="${nodeId(e.target)}" />`;
  });

  const shapes = doc.nodes.map((n) => {
    const b = nodeBounds(n);
    const marker = n.type === "condition" ? ' isMarkerVisible="true"' : "";
    return `<bpmndi:BPMNShape id="${nodeId(n.id)}_di" bpmnElement="${nodeId(n.id)}"${marker}><dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" /></bpmndi:BPMNShape>`;
  });

  const diEdges = edges.map((e) => {
    const s = nodeBounds(nodeById.get(e.source)!);
    const t = nodeBounds(nodeById.get(e.target)!);
    return `<bpmndi:BPMNEdge id="${flowId(e.id)}_di" bpmnElement="${flowId(e.id)}"><di:waypoint x="${s.x + s.w}" y="${Math.round(s.y + s.h / 2)}" /><di:waypoint x="${t.x}" y="${Math.round(t.y + t.h / 2)}" /></bpmndi:BPMNEdge>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">`,
    `<bpmn:process id="Process_1" isExecutable="false">`,
    ...processEls,
    ...flowEls,
    `</bpmn:process>`,
    `<bpmndi:BPMNDiagram id="Diagram_1">`,
    `<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">`,
    ...shapes,
    ...diEdges,
    `</bpmndi:BPMNPlane>`,
    `</bpmndi:BPMNDiagram>`,
    `</bpmn:definitions>`,
  ].join("\n");
}
