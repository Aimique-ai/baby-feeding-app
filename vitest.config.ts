import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/planning/**", "lib/time/**"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      reporter: ["text", "html"],
    },
  },
});
