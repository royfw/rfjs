"use client";

import { ConfigFormBuilder } from "@rfjs/form-builder-ui";

import { SAMPLE_CONFIG, sampleFetcher } from "./sample";

export function FormBuilderTool() {
  return (
    <div className="flex flex-col gap-5">
      <ConfigFormBuilder initialConfig={SAMPLE_CONFIG} locales={["en", "zh-TW"]} fetcher={sampleFetcher} />
    </div>
  );
}
