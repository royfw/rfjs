import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@rfjs/web-ui",
    "@rfjs/web-core",
    "@rfjs/filter-builder-ui",
    "@rfjs/form-builder-ui",
    "@rfjs/bpmn-ui",
    "@rfjs/data-schema-ui",
    "@rfjs/table-builder-ui",
    "@rfjs/ai-assist-ui",
  ],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
