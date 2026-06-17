import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rfjs/web-ui", "@rfjs/web-core", "@rfjs/filter-builder-ui"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
