import type { NextConfig } from "next";

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
};

export default nextConfig;
