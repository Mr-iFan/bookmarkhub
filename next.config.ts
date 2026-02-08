import type { NextConfig } from "next";

const normalizeBasePath = (value?: string) => {
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "");
};

const basePath = normalizeBasePath(process.env.NEXT_BASE_PATH);
const assetPrefix = basePath || undefined;

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.yaml": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.yml": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
    resolveExtensions: [".yaml", ".yml", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  output: "export",
  basePath,
  assetPrefix,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
