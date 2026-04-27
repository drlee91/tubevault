import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest 4 removed `environmentMatchGlobs` (deprecated in v3). The replacement
// is `projects`: each project gets its own glob + environment. Node-environment
// tests live in the default project; component tests under app/ + components/
// run under happy-dom.
export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/*.config.*", "**/.next/**", "**/drizzle/**", "tests/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "**/.next/**",
            "app/**/*.test.tsx",
            "components/**/*.test.tsx",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["app/**/*.test.tsx", "components/**/*.test.tsx", "lib/client/**/*.test.tsx"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
