import { generateRegistry } from "./scripts/registry.mjs";
generateRegistry();
const config = {
  devIndicators: false,
  experimental: { cpus: 2 },
  images: { unoptimized: true },
};

export default config;
