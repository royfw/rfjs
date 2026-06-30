import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "flow-builder": {
        title: "Flow Builder",
        description: "Visually wire a no-code flow — drag form / condition / action nodes onto a canvas, edit each node with the embedded builders, and see the flow JSON live. (Phase 1: edit only, no execution.)",
      },
    },
    ToolUI: {
      flowEyebrow: "FLOW BUILDER",
      flowAddForm: "+ Form",
      flowAddCondition: "+ Condition",
      flowAddAction: "+ Action",
      flowAddEnd: "+ End",
      flowInspector: "Inspector",
      flowJson: "Flow JSON",
      flowSelectHint: "Select a node to edit it.",
      flowFilterAddCondition: "+ condition",
      flowFilterAddGroup: "+ group",
      flowFilterRemoveGroup: "remove group",
      flowFilterRemoveCondition: "remove",
      flowFilterElemMatch: "elemmatch",
    },
  },
  "zh-TW": {
    Tools: {
      "flow-builder": {
        title: "流程建構器",
        description: "視覺化串接 no-code 流程 —— 把表單 / 條件 / 動作節點拖到畫布、用內嵌的編輯器設定每個節點,並即時看到 flow JSON。(Phase 1:只編輯、不執行。)",
      },
    },
    ToolUI: {
      flowEyebrow: "流程建構器",
      flowAddForm: "+ 表單",
      flowAddCondition: "+ 條件",
      flowAddAction: "+ 動作",
      flowAddEnd: "+ 結束",
      flowInspector: "屬性面板",
      flowJson: "流程 JSON",
      flowSelectHint: "選一個節點來編輯。",
      flowFilterAddCondition: "+ 條件",
      flowFilterAddGroup: "+ 群組",
      flowFilterRemoveGroup: "移除群組",
      flowFilterRemoveCondition: "移除",
      flowFilterElemMatch: "elemmatch",
    },
  },
};
