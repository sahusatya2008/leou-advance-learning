import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Python face service environment and source (InsightFace/DeepFace).
    "face/.venv/**",
    "face/**",
    // Static assets served as-is. `public/vendor/monaco` alone is 24 MB of
    // minified JS; parsing it drives the linter into a heap OOM.
    "public/**",
  ]),
]);

export default eslintConfig;
