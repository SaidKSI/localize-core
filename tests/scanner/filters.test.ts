import { describe, it, expect } from "vitest";
import {
  shouldFilter,
  isTooShort,
  isPurelyNumeric,
  isUrl,
  isRelativePath,
  isModuleSpecifier,
  isCssClassString,
  NON_TRANSLATABLE_ATTRS,
  TRANSLATION_FNS,
} from "../../src/scanner/filters.js";
import { makeConfig } from "../helpers/config.js";

describe("filters", () => {
  describe("isTooShort", () => {
    it("returns true for single character", () => {
      expect(isTooShort("A")).toBe(true);
    });

    it("returns true for whitespace only", () => {
      expect(isTooShort("  ")).toBe(true);
    });

    it("returns false for 2+ characters", () => {
      expect(isTooShort("OK")).toBe(false);
    });

    it("returns false for normal strings", () => {
      expect(isTooShort("Welcome back")).toBe(false);
    });
  });

  describe("isPurelyNumeric", () => {
    it("returns true for integer", () => {
      expect(isPurelyNumeric("123")).toBe(true);
    });

    it("returns true for decimal", () => {
      expect(isPurelyNumeric("3.14")).toBe(true);
    });

    it("returns true for CSS units", () => {
      expect(isPurelyNumeric("100px")).toBe(true);
      expect(isPurelyNumeric("2.5rem")).toBe(true);
      expect(isPurelyNumeric("50%")).toBe(true);
    });

    it("returns false for text with numbers", () => {
      expect(isPurelyNumeric("User123")).toBe(false);
    });

    it("returns false for normal strings", () => {
      expect(isPurelyNumeric("Welcome")).toBe(false);
    });
  });

  describe("isUrl", () => {
    it("returns true for http/https", () => {
      expect(isUrl("https://example.com")).toBe(true);
      expect(isUrl("http://example.com")).toBe(true);
    });

    it("returns true for mailto", () => {
      expect(isUrl("mailto:support@example.com")).toBe(true);
    });

    it("returns true for protocol-relative", () => {
      expect(isUrl("//cdn.example.com/file.js")).toBe(true);
    });

    it("returns false for plain text", () => {
      expect(isUrl("Welcome back")).toBe(false);
    });
  });

  describe("isRelativePath", () => {
    it("returns true for ./path", () => {
      expect(isRelativePath("./src/index.ts")).toBe(true);
    });

    it("returns true for ../path", () => {
      expect(isRelativePath("../utils/index.ts")).toBe(true);
    });

    it("returns false for absolute paths", () => {
      expect(isRelativePath("/src/index.ts")).toBe(false);
    });

    it("returns false for plain text", () => {
      expect(isRelativePath("Welcome back")).toBe(false);
    });
  });

  describe("isModuleSpecifier", () => {
    it("returns true for lowercase package names", () => {
      expect(isModuleSpecifier("react")).toBe(true);
      expect(isModuleSpecifier("next-intl")).toBe(true);
    });

    it("returns true for scoped packages", () => {
      expect(isModuleSpecifier("@scope/pkg")).toBe(true);
      expect(isModuleSpecifier("@babel/traverse")).toBe(true);
    });

    it("returns true for subpaths", () => {
      expect(isModuleSpecifier("@babel/traverse/lib")).toBe(true);
    });

    it("returns false for strings starting with uppercase", () => {
      expect(isModuleSpecifier("React")).toBe(false);
      expect(isModuleSpecifier("Welcome")).toBe(false);
    });

    it("returns false for normal sentences", () => {
      expect(isModuleSpecifier("user profile")).toBe(false);
    });
  });

  describe("isCssClassString", () => {
    it("returns true for multi-token CSS classes", () => {
      expect(isCssClassString("flex items-center bg-gray-100")).toBe(true);
      expect(isCssClassString("flex justify-between p-4")).toBe(true);
    });

    it("requires CSS indicators (hyphen, colon, bracket)", () => {
      expect(isCssClassString("flex items center")).toBe(false);
      expect(isCssClassString("one two three")).toBe(false);
    });

    it("returns false for single token", () => {
      expect(isCssClassString("flex")).toBe(false);
      expect(isCssClassString("text-lg")).toBe(false);
    });

    it("returns false for plain English phrases", () => {
      expect(isCssClassString("pending tasks")).toBe(false);
      expect(isCssClassString("hello world")).toBe(false);
    });

    it("handles responsive prefixes", () => {
      // Must have CSS indicators in tokens
      expect(isCssClassString("sm:flex md:hidden p-4")).toBe(true);
    });

    it("handles negation prefix", () => {
      expect(isCssClassString("-mx-2 p-4")).toBe(true);
    });
  });

  describe("shouldFilter", () => {
    const config = makeConfig();

    it("filters too-short strings", () => {
      expect(shouldFilter("A", config)).toBe(true);
    });

    it("filters numeric values", () => {
      expect(shouldFilter("100px", config)).toBe(true);
    });

    it("filters URLs", () => {
      expect(shouldFilter("https://example.com", config)).toBe(true);
    });

    it("filters relative paths", () => {
      expect(shouldFilter("./src/index", config)).toBe(true);
    });

    it("filters CSS class strings", () => {
      expect(shouldFilter("flex items-center bg-gray-100", config)).toBe(true);
    });

    it("filters module specifiers", () => {
      expect(shouldFilter("react-i18next", config)).toBe(true);
      expect(shouldFilter("@babel/traverse", config)).toBe(true);
    });

    it("does not filter normal user-facing text", () => {
      expect(shouldFilter("Welcome back", config)).toBe(false);
      expect(shouldFilter("Sign in to continue", config)).toBe(false);
    });

    it("respects JSX flag for module specifiers", () => {
      // In JSX context, we don't filter module specifiers
      expect(shouldFilter("react", config, true)).toBe(false);
    });

    it("respects ignorePatterns", () => {
      const configWithIgnore = makeConfig({
        ignorePatterns: ["^debug.*"],
      });
      expect(shouldFilter("debug message", configWithIgnore)).toBe(true);
      expect(shouldFilter("normal text", configWithIgnore)).toBe(false);
    });

    it("treats malformed ignore patterns as non-matching", () => {
      const configWithBadRegex = makeConfig({
        ignorePatterns: ["[invalid(regex"],
      });
      // Invalid regex patterns fail to match (try-catch returns false)
      // So "test" is not filtered by the invalid pattern
      // It also passes all other filters (not too short, not numeric, etc.)
      expect(shouldFilter("test string", configWithBadRegex)).toBe(false);
    });
  });

  describe("NON_TRANSLATABLE_ATTRS", () => {
    it("contains common structural attributes", () => {
      expect(NON_TRANSLATABLE_ATTRS.has("className")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("data-testid")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("href")).toBe(true);
    });

    it("contains form attributes", () => {
      expect(NON_TRANSLATABLE_ATTRS.has("type")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("name")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("value")).toBe(true);
    });

    it("contains src attributes", () => {
      expect(NON_TRANSLATABLE_ATTRS.has("src")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("srcSet")).toBe(true);
    });

    it("contains SVG attributes", () => {
      expect(NON_TRANSLATABLE_ATTRS.has("viewBox")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("d")).toBe(true);
      expect(NON_TRANSLATABLE_ATTRS.has("fill")).toBe(true);
    });
  });

  describe("TRANSLATION_FNS", () => {
    it("contains common translation function names", () => {
      expect(TRANSLATION_FNS.has("t")).toBe(true);
      expect(TRANSLATION_FNS.has("formatMessage")).toBe(true);
      expect(TRANSLATION_FNS.has("$t")).toBe(true);
      expect(TRANSLATION_FNS.has("i18n")).toBe(true);
    });
  });
});
