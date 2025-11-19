import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  roots: ["<rootDir>"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["<rootDir>/__tests__/**/*.spec.(ts|tsx)", "<rootDir>/__tests__/**/*.test.(ts|tsx)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/test/__mocks__/server-only.ts",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  clearMocks: true,
  verbose: false,
};

export default config;
