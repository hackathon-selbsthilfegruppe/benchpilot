import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// `eslint-config-next` already registers `eslint-plugin-jsx-a11y` as a
// plugin. We can't redefine it, so layer just the *rules* from the
// plugin's recommended config on top.
const jsxA11yRecommendedRules = jsxA11y.flatConfigs.recommended.rules ?? {};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      ...jsxA11yRecommendedRules,
      // WAI-ARIA window-splitter pattern: role="separator" with
      // tabindex="0" is the documented way to make a resize handle
      // keyboard-accessible. Allow it explicitly so we don't need
      // per-element disables.
      // https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { roles: ["separator", "tabpanel"], tags: [], allowExpressionValues: true },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyDown",
            "onKeyUp",
          ],
          allowExpressionValues: true,
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
