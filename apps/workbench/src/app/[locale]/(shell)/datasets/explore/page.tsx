import { getTranslations, setRequestLocale } from "next-intl/server";

import { DatasetExplorer, type ExplorerLabels } from "@/components/explorer/dataset-explorer";

export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Explorer");
  const labels: ExplorerLabels = {
    title: t("title"),
    description: t("description"),
    run: t("run"),
    running: t("running"),
    loading: t("loading"),
    empty: t("empty"),
    error: t("error"),
    results: t("results"),
    columnName: t("columnName"),
    columnDescription: t("columnDescription"),
    columnCreated: t("columnCreated"),
    columnUpdated: t("columnUpdated"),
    emptyDescription: t("emptyDescription"),
    tree: {
      logic: { and: t("tree.and"), or: t("tree.or"), nor: t("tree.nor"), not: t("tree.not") },
      addCondition: t("tree.addCondition"),
      addGroup: t("tree.addGroup"),
      removeGroup: t("tree.removeGroup"),
      removeCondition: t("tree.removeCondition"),
      elemMatch: t("tree.elemMatch"),
      toggleGroup: t("tree.toggleGroup"),
      collapsedConditions: t("tree.collapsedConditions"),
      collapsedGroups: t("tree.collapsedGroups"),
      collapsedEmpty: t("tree.collapsedEmpty"),
    },
  };
  return <DatasetExplorer labels={labels} />;
}
