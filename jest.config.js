/** @type {import('jest').Config} */
module.exports = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/unit/**/*.test.tsx",
  ],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", {
      jsc: {
        transform: {
          react: { runtime: "automatic" }
        }
      }
    }],
  },
  moduleNameMapper: {
    // Path alias
    "^@/(.*)$": "<rootDir>/src/$1",
    // Stub server-only
    "^server-only$": "<rootDir>/tests/__mocks__/server-only.ts",
    // Stub next/headers
    "^next/headers$": "<rootDir>/tests/__mocks__/next-headers.ts",
    // Stub next/font
    "^next/font/(.*)$": "<rootDir>/tests/__mocks__/next-font.ts",
    // Stub next/navigation
    "^next/navigation$": "<rootDir>/tests/__mocks__/next-navigation.ts",
    // Stub next/link (use native anchor for testing)
    "^next/link$": "<rootDir>/tests/__mocks__/next-link.ts",
    // Stub CSS imports
    "^.+\\.css$": "<rootDir>/tests/__mocks__/style-mock.ts",
  },
};
