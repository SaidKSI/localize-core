import type { LocalizerConfig } from "../../src/types.js";

/**
 * Helper factory for creating minimal LocalizerConfig objects in tests.
 * Provides sensible defaults that can be overridden.
 */
export function makeConfig(overrides?: Partial<LocalizerConfig>): LocalizerConfig {
  return {
    defaultLanguage: "en",
    languages: ["en", "fr"],
    messagesDir: "messages",
    include: ["src"],
    exclude: ["node_modules", "dist"],
    aiProvider: "anthropic",
    aiModel: "claude-haiku-4-5-20251001",
    keyStyle: "snake_case",
    i18nLibrary: "react-i18next",
    overwriteExisting: false,
    strictMode: false,
    glossary: {},
    ignorePatterns: [],
    ignoreFiles: [],
    ...overrides,
  };
}
