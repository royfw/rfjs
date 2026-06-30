import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "bpmn-viewer": {
        title: "BPMN Viewer",
        description:
          "Render read-only BPMN 2.0 process diagrams from XML — pick a sample, paste XML, or upload a .bpmn file, then zoom and fit.",
      },
    },
    ToolUI: {
      bpmnEyebrow: "BPMN VIEWER",
      bpmnSample: "Sample",
      bpmnUpload: "Upload .bpmn",
      bpmnPasteLabel: "Paste BPMN XML",
      bpmnApply: "Render",
      bpmnZoomIn: "Zoom in",
      bpmnZoomOut: "Zoom out",
      bpmnReset: "Reset",
      bpmnFit: "Fit",
      bpmnErrExtension: "Unsupported file type — use .bpmn or .xml",
      bpmnErrSize: "File too large (max 1 MB)",
      bpmnErrEmpty: "File is empty",
      bpmnErrImport: "Could not render this diagram — the XML may be invalid",
      bpmnErrRead: "Could not read the file",
    },
  },
  "zh-TW": {
    Tools: {
      "bpmn-viewer": {
        title: "BPMN 檢視器",
        description:
          "從 XML 渲染唯讀的 BPMN 2.0 流程圖 —— 選範例、貼上 XML 或上傳 .bpmn 檔,再縮放與 fit。",
      },
    },
    ToolUI: {
      bpmnEyebrow: "BPMN 檢視器",
      bpmnSample: "範例",
      bpmnUpload: "上傳 .bpmn",
      bpmnPasteLabel: "貼上 BPMN XML",
      bpmnApply: "渲染",
      bpmnZoomIn: "放大",
      bpmnZoomOut: "縮小",
      bpmnReset: "重設",
      bpmnFit: "符合畫面",
      bpmnErrExtension: "不支援的檔案類型 —— 請用 .bpmn 或 .xml",
      bpmnErrSize: "檔案過大(上限 1 MB)",
      bpmnErrEmpty: "檔案是空的",
      bpmnErrImport: "無法渲染此圖 —— XML 可能無效",
      bpmnErrRead: "無法讀取檔案",
    },
  },
};
