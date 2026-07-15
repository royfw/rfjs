import { useTranslations } from "next-intl";
import type { AiPanelLabels } from "@rfjs/ai-assist-ui";

/** 把 ToolUI 的 AI 文案組成 AiPanel 的 labels(labels-as-props;DRY 於四個工具)。 */
export function useAiPanelLabels(): AiPanelLabels {
  const t = useTranslations("ToolUI");
  return {
    kindGenerate: t("aiKindGenerate"),
    kindAsk: t("aiKindAsk"),
    kindExplain: t("aiKindExplain"),
    kindCheck: t("aiKindCheck"),
    cancel: t("aiCancel"),
    notConfigured: t("aiNotConfigured"),
    viewRaw: t("aiViewRaw"),
    thinking: t("aiThinking"),
    answers: t("aiAnswers"),
    advisory: t("aiAdvisory"),
    clear: t("aiClear"),
    reapply: t("aiReapply"),
  };
}
