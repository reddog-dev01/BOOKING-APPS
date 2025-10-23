require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
  ignorePatterns: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": "off",
  },
};
