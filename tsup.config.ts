import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", webhooks: "src/webhooks/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2022",
  platform: "neutral",
  sourcemap: true,
});
