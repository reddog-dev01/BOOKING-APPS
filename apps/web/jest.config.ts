import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/__tests__/**/*.spec.ts"],
  moduleDirectories: ["node_modules", "<rootDir>", "<rootDir>/../.."],
  moduleNameMapper: {
    "^server-only$": "<rootDir>/test/__mocks__/server-only.ts",
  },
  clearMocks: true,
};

export default config;
