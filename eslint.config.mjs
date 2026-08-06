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
    // Agent toolboxes that `npx skills add` installs into the repo. They are
    // third-party scripts, not product code, and linting them buried the real
    // findings — six of this project's own problems under twenty-one of theirs.
    ".agents/**",
    ".hermes/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
