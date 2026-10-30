import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "coverage/**"],
  },

  js.configs.recommended,

  {
    files: ["**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": "warn", //Warns about variables that are declared but never used
      "no-undef": "error", //Detects variables or functions that are not defined
      "no-console": "off", //Allows console.log() and other console statements
    },
  },
];