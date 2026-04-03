import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { flattenKeys, validateCoverage, getMissingKeys, isFullyCovered } from "../../src/validator/index.js";
import type { LocalizerConfig } from "../../src/types.js";
import { makeConfig } from "../helpers/config.js";

describe("validator", () => {
  describe("flattenKeys", () => {
    it("returns empty array for empty object", () => {
      const result = flattenKeys({});
      expect(result).toEqual([]);
    });

    it("flattens single-level keys", () => {
      const obj = { title: "Login", subtitle: "Sign in" };
      const result = flattenKeys(obj);
      expect(result).toContain("title");
      expect(result).toContain("subtitle");
      expect(result).toHaveLength(2);
    });

    it("flattens nested objects with dot notation", () => {
      const obj = {
        auth: {
          title: "Login",
          sign_in: "Sign in",
        },
      };
      const result = flattenKeys(obj);
      expect(result).toContain("auth.title");
      expect(result).toContain("auth.sign_in");
      expect(result).toHaveLength(2);
    });

    it("flattens deeply nested objects", () => {
      const obj = {
        auth: {
          forms: {
            login: {
              title: "Login",
            },
          },
        },
      };
      const result = flattenKeys(obj);
      expect(result).toContain("auth.forms.login.title");
      expect(result).toHaveLength(1);
    });

    it("handles mixed depths", () => {
      const obj = {
        simple: "value",
        nested: {
          deep: {
            value: "test",
          },
        },
      };
      const result = flattenKeys(obj);
      expect(result).toContain("simple");
      expect(result).toContain("nested.deep.value");
      expect(result).toHaveLength(2);
    });

    it("ignores arrays and null values", () => {
      const obj = {
        array: [1, 2, 3],
        nullValue: null,
        valid: "text",
      };
      const result = flattenKeys(obj);
      expect(result).toContain("array");
      expect(result).toContain("nullValue");
      expect(result).toContain("valid");
      expect(result).toHaveLength(3);
    });
  });

  describe("validateCoverage", () => {
    let tempDir: string;

    beforeEach(async () => {
      // Create a temporary directory for test files
      tempDir = join(process.cwd(), `.test-messages-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      // Cleanup
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it("validates coverage for configured languages", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const enContent = JSON.stringify({ auth: { title: "Login", submit: "Sign in" } });
      const frContent = JSON.stringify({ auth: { title: "Connexion", submit: "Se connecter" } });

      await writeFile(join(enDir, "login.json"), enContent);
      await writeFile(join(frDir, "login.json"), frContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const results = await validateCoverage(config);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it("default language always has 100% coverage", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const enContent = JSON.stringify({ auth: { title: "Login" } });
      const frContent = JSON.stringify({});

      await writeFile(join(enDir, "login.json"), enContent);
      await writeFile(join(frDir, "login.json"), frContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const results = await validateCoverage(config);
      const enResult = results.find((r) => r.language === "en");

      expect(enResult).toBeDefined();
      expect(enResult?.coveragePercent).toBe(100);
    });

    it("target language shows missing keys", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const enContent = JSON.stringify({ auth: { title: "Login", submit: "Sign in" } });
      const frContent = JSON.stringify({ auth: { title: "Connexion" } });

      await writeFile(join(enDir, "login.json"), enContent);
      await writeFile(join(frDir, "login.json"), frContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const results = await validateCoverage(config);
      const frResult = results.find((r) => r.language === "fr");

      expect(frResult).toBeDefined();
      expect(frResult?.coveragePercent).toBeLessThan(100);
      expect(frResult?.missingKeys).toBeDefined();
      expect(frResult?.missingKeys).toContain("auth.submit");
    });

    it("returns default language first", async () => {
      const enDir = join(tempDir, "en");
      const esDir = join(tempDir, "es");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(esDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const content = JSON.stringify({ text: "Hello" });
      await writeFile(join(enDir, "page.json"), content);
      await writeFile(join(esDir, "page.json"), content);
      await writeFile(join(frDir, "page.json"), content);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "es", "fr"],
        defaultLanguage: "en",
      });

      const results = await validateCoverage(config);
      expect(results[0]?.language).toBe("en");
    });
  });

  describe("getMissingKeys", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(process.cwd(), `.test-missing-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it("returns empty array when all keys are present", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const content = JSON.stringify({ auth: { title: "Login", submit: "Sign in" } });
      await writeFile(join(enDir, "login.json"), content);
      await writeFile(join(frDir, "login.json"), content);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const missing = await getMissingKeys(config, "fr");
      expect(missing).toEqual([]);
    });

    it("returns missing keys in target language", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const enContent = JSON.stringify({ auth: { title: "Login", submit: "Sign in", cancel: "Cancel" } });
      const frContent = JSON.stringify({ auth: { title: "Connexion" } });
      await writeFile(join(enDir, "login.json"), enContent);
      await writeFile(join(frDir, "login.json"), frContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const missing = await getMissingKeys(config, "fr");
      expect(missing).toContain("auth.submit");
      expect(missing).toContain("auth.cancel");
      expect(missing).not.toContain("auth.title");
    });

    it("merges keys from multiple page files", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      // EN has keys from both pages
      const enLoginContent = JSON.stringify({ login_title: "Login" });
      const enDashContent = JSON.stringify({ dashboard_title: "Dashboard" });
      // FR is missing the dashboard key
      const frLoginContent = JSON.stringify({ login_title: "Connexion" });
      const frDashContent = JSON.stringify({}); // empty file

      await writeFile(join(enDir, "login.json"), enLoginContent);
      await writeFile(join(enDir, "dashboard.json"), enDashContent);
      await writeFile(join(frDir, "login.json"), frLoginContent);
      await writeFile(join(frDir, "dashboard.json"), frDashContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const missing = await getMissingKeys(config, "fr");
      expect(missing).toContain("dashboard_title");
      expect(missing).not.toContain("login_title");
    });
  });

  describe("isFullyCovered", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(process.cwd(), `.test-coverage-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it("returns true when all languages are fully covered", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const content = JSON.stringify({ auth: { title: "Login" } });
      await writeFile(join(enDir, "login.json"), content);
      await writeFile(join(frDir, "login.json"), content);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const result = await isFullyCovered(config);
      expect(result).toBe(true);
    });

    it("returns false when any language has missing keys", async () => {
      const enDir = join(tempDir, "en");
      const frDir = join(tempDir, "fr");
      await mkdir(enDir, { recursive: true });
      await mkdir(frDir, { recursive: true });

      const enContent = JSON.stringify({ auth: { title: "Login", submit: "Sign in" } });
      const frContent = JSON.stringify({ auth: { title: "Connexion" } });
      await writeFile(join(enDir, "login.json"), enContent);
      await writeFile(join(frDir, "login.json"), frContent);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en", "fr"],
      });

      const result = await isFullyCovered(config);
      expect(result).toBe(false);
    });

    it("returns true when only default language exists", async () => {
      const enDir = join(tempDir, "en");
      await mkdir(enDir, { recursive: true });
      const content = JSON.stringify({ auth: { title: "Login" } });
      await writeFile(join(enDir, "login.json"), content);

      const config: LocalizerConfig = makeConfig({
        messagesDir: tempDir,
        languages: ["en"],
      });

      const result = await isFullyCovered(config);
      expect(result).toBe(true);
    });
  });
});
