import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler's set-state-in-effect fires on patterns that are correct
      // for this client-side Supabase SPA: fetch-on-mount, hydration-safe DOM
      // reads (theme), dialog-reset-on-open, and syncing form state from
      // async-loaded settings. None are bugs; contorting each site (or inlining
      // every loader into its effect) would add complexity to appease the rule.
      // Kept as a warning so genuinely new synchronous-setState mistakes still
      // surface. Revisit if the data layer moves to a fetch hook / Server Components.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
