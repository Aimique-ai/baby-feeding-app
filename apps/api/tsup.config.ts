import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  platform: "node",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  // Workspace TS-only packages must be inlined; runtime deps stay external.
  noExternal: [/^@leon\//],
});
