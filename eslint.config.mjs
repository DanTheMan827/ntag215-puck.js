import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["ntag215.js"],
    languageOptions: {
      sourceType: "script"
    }
  },
  {
    languageOptions: {
      globals: {
        process: "readonly",
        require: "readonly",
        clearTimeout: "readonly",
        setTimeout: "readonly",
        setWatch: "readonly",
        clearWatch: "readonly",
        console: "readonly",
        E: "readonly",
        NRF: "readonly",
        analogWrite: "readonly",
        digitalWrite: "readonly",
        D14: "readonly"
      }
    }
  },
  pluginJs.configs.recommended,
  {
    rules: {
      "prefer-const": ["warn", {
        "destructuring": "all",
        "ignoreReadBeforeAssign": true
      }],
      "no-unused-vars": ["error", {
        "varsIgnorePattern": "^_|fastMode",
        "argsIgnorePattern": "^_"
      }],
      "no-var": "error",
      "indent": ["error", 2, { "SwitchCase": 1 }],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "never"],
      "space-before-function-paren": ["error", "never"],
      "keyword-spacing": ["error", { "before": true, "after": true }],
      "newline-before-return": "error",
      "padding-line-between-statements": [
        "error",
        { "blankLine": "always", "prev": "*", "next": "return" },
        { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*"},
        { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] },
        { "blankLine": "always", "prev": "*", "next": ["if", "for", "while", "switch", "try"] },
        { "blankLine": "always", "prev": ["if", "for", "while", "switch", "try"], "next": "*" }
      ]
    }
  }
];
