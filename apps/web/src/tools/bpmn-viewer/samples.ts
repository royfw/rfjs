export interface BpmnSample {
  id: string;
  label: string;
  xml: string;
}

const LEAVE_REQUEST = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_Leave" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveRequest" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Submit request"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_1" name="Manager review"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="End_1" name="Notified"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_Leave">
    <bpmndi:BPMNPlane id="Plane_Leave" bpmnElement="LeaveRequest">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="152" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="240" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="392" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="188" y="120" /><di:waypoint x="240" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="120" /><di:waypoint x="392" y="120" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const ORDER_APPROVAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_Order" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderApproval" isExecutable="false">
    <bpmn:startEvent id="O_Start" name="Order placed"><bpmn:outgoing>O_F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="O_Gw" name="Amount > 1000?"><bpmn:incoming>O_F1</bpmn:incoming><bpmn:outgoing>O_F2</bpmn:outgoing><bpmn:outgoing>O_F3</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="O_Review" name="Manual review"><bpmn:incoming>O_F2</bpmn:incoming><bpmn:outgoing>O_F4</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="O_Auto" name="Auto-approved"><bpmn:incoming>O_F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="O_Done" name="Approved"><bpmn:incoming>O_F4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="O_F1" sourceRef="O_Start" targetRef="O_Gw" />
    <bpmn:sequenceFlow id="O_F2" name="yes" sourceRef="O_Gw" targetRef="O_Review" />
    <bpmn:sequenceFlow id="O_F3" name="no" sourceRef="O_Gw" targetRef="O_Auto" />
    <bpmn:sequenceFlow id="O_F4" sourceRef="O_Review" targetRef="O_Done" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_Order">
    <bpmndi:BPMNPlane id="Plane_Order" bpmnElement="OrderApproval">
      <bpmndi:BPMNShape id="O_Start_di" bpmnElement="O_Start"><dc:Bounds x="152" y="142" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Gw_di" bpmnElement="O_Gw" isMarkerVisible="true"><dc:Bounds x="245" y="135" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Review_di" bpmnElement="O_Review"><dc:Bounds x="360" y="120" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Auto_di" bpmnElement="O_Auto"><dc:Bounds x="392" y="252" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Done_di" bpmnElement="O_Done"><dc:Bounds x="512" y="142" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="O_F1_di" bpmnElement="O_F1"><di:waypoint x="188" y="160" /><di:waypoint x="245" y="160" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F2_di" bpmnElement="O_F2"><di:waypoint x="295" y="160" /><di:waypoint x="360" y="160" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F3_di" bpmnElement="O_F3"><di:waypoint x="270" y="185" /><di:waypoint x="270" y="270" /><di:waypoint x="392" y="270" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F4_di" bpmnElement="O_F4"><di:waypoint x="460" y="160" /><di:waypoint x="512" y="160" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const SAMPLES: BpmnSample[] = [
  { id: "leave-request", label: "Leave Request", xml: LEAVE_REQUEST },
  { id: "order-approval", label: "Order Approval", xml: ORDER_APPROVAL },
];

export const DEFAULT_SAMPLE_ID = "leave-request";

export function getSample(id: string): BpmnSample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
