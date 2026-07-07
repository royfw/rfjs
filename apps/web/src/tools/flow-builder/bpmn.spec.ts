import { describe, expect, it } from "vitest";

import type { FlowDoc } from "./schema";
import { sample } from "./sample";
import { compileToBpmn, escapeXml, makeIdMapper } from "./bpmn";

describe("escapeXml", () => {
  it("escapes the five xml special characters", () => {
    expect(escapeXml(`a<b>&"c"'d'`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;&apos;d&apos;");
  });
});

describe("makeIdMapper", () => {
  it("prefixes and keeps ncname-safe chars", () => {
    const map = makeIdMapper("Node");
    expect(map("form-1")).toBe("Node_form-1");
  });

  it("is stable for the same raw id", () => {
    const map = makeIdMapper("Node");
    expect(map("a")).toBe(map("a"));
  });

  it("sanitizes illegal chars and resolves collisions deterministically", () => {
    const map = makeIdMapper("Node");
    expect(map("a b")).toBe("Node_a_b");
    expect(map("a_b")).toBe("Node_a_b_2"); // sanitize 後撞名 → 附序號
    expect(map("a b")).toBe("Node_a_b"); // 既有對映不受影響
  });
});

/** 收集 XML 內所有 id 與引用,驗證引用完整性(輕量 regex parse,不引第三方)。 */
function collectIdsAndRefs(xml: string): { ids: Set<string>; refs: string[] } {
  const ids = new Set([...xml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
  const refs = [
    ...[...xml.matchAll(/\b(?:sourceRef|targetRef|bpmnElement)="([^"]+)"/g)].map((m) => m[1]!),
    ...[...xml.matchAll(/<bpmn:(?:incoming|outgoing)>([^<]+)</g)].map((m) => m[1]!),
  ];
  return { ids, refs };
}

describe("compileToBpmn", () => {
  const xml = compileToBpmn(sample);

  it("maps node types to bpmn elements", () => {
    expect(xml).toContain("<bpmn:startEvent");
    expect(xml).toContain("<bpmn:endEvent");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:exclusiveGateway");
    expect(xml).toContain("<bpmn:serviceTask");
  });

  it("has the required document skeleton", () => {
    expect(xml).toContain("<bpmn:definitions");
    expect(xml).toContain('<bpmn:process id="Process_1" isExecutable="false">');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    expect(xml).toContain('<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">');
  });

  it("every ref points to an existing id", () => {
    const { ids, refs } = collectIdsAndRefs(xml);
    for (const ref of refs) expect(ids.has(ref), `unresolved ref: ${ref}`).toBe(true);
  });

  it("every node has a shape and every edge has a di edge", () => {
    expect([...xml.matchAll(/<bpmndi:BPMNShape /g)]).toHaveLength(sample.nodes.length);
    expect([...xml.matchAll(/<bpmndi:BPMNEdge /g)]).toHaveLength(sample.edges.length);
  });

  it("uses standard bpmn sizes centered on the flowdoc node center", () => {
    // sample 的 start 在 (40,127),RF 佔位 150×46 → 中心 (115,150) → 36×36 的左上 (97,132)
    expect(xml).toContain('<dc:Bounds x="97" y="132" width="36" height="36" />');
    // condition 在 (460,127) → 中心 (535,150) → 50×50 的左上 (510,125)
    expect(xml).toContain('<dc:Bounds x="510" y="125" width="50" height="50" />');
    // form 在 (250,119),150×62 → bounds 原值
    expect(xml).toContain('<dc:Bounds x="250" y="119" width="150" height="62" />');
    // gateway 有 marker
    expect(xml).toContain('isMarkerVisible="true"');
  });

  it("waypoints run from source right-center to target left-center", () => {
    // start(36×36 @ 97,132)右緣中心 (133,150) → form(150×62 @ 250,119)左緣中心 (250,150)
    expect(xml).toContain('<di:waypoint x="133" y="150" /><di:waypoint x="250" y="150" />');
  });

  it("condition yes/no outgoing flows carry names", () => {
    expect(xml).toMatch(/<bpmn:sequenceFlow [^>]*name="yes"/);
    expect(xml).toMatch(/<bpmn:sequenceFlow [^>]*name="no"/);
  });

  it("names: action includes its kind; labels are escaped", () => {
    expect(xml).toContain('name="Action: notify"');
    const hostile: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "e", type: "end", position: { x: 200, y: 0 } },
      ],
      edges: [{ id: "x", source: "s", target: "e", label: 'a<b>&"c"' }],
    };
    const out = compileToBpmn(hostile);
    expect(out).toContain('name="a&lt;b&gt;&amp;&quot;c&quot;"');
  });

  it("skips edges whose source/target node does not exist (orphan guard)", () => {
    const broken: FlowDoc = {
      version: 1,
      nodes: [{ id: "s", type: "start", position: { x: 0, y: 0 } }],
      edges: [{ id: "x", source: "s", target: "ghost" }],
    };
    const out = compileToBpmn(broken);
    expect(out).not.toContain("sequenceFlow");
    const { ids, refs } = collectIdsAndRefs(out);
    for (const ref of refs) expect(ids.has(ref)).toBe(true);
  });
});
