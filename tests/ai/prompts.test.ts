import { describe, it, expect } from "vitest";
import { buildTranslationPrompt, parseAIResponse } from "../../src/ai/prompts.js";
import type { AIRequest } from "../../src/types.js";

describe("prompts", () => {
  describe("buildTranslationPrompt", () => {
    it("returns a non-empty string", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en", "fr", "es"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt.length).toBeGreaterThan(0);
      expect(typeof prompt).toBe("string");
    });

    it("includes the string value in the prompt", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en", "fr", "es"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt).toContain("Welcome back");
    });

    it("includes target languages in the prompt", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["fr", "es"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt.toLowerCase()).toContain("french");
      expect(prompt.toLowerCase()).toContain("spanish");
    });

    it("includes key style hint in the prompt", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt.toLowerCase()).toContain("snake_case");
    });

    it("includes surrounding code context", () => {
      const code = '  <h1>Welcome back</h1>';
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: code,
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt).toContain(code);
    });

    it("includes glossary terms when provided", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Settings</h1>',
        value: "Settings",
        keyStyle: "snake_case",
        glossary: {
          fr: "Paramètres",
          es: "Configuración",
        },
        targetLanguages: ["fr", "es"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt).toContain("Paramètres");
      expect(prompt).toContain("Configuración");
    });

    it("skips glossary section when empty", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en"],
      };

      const prompt = buildTranslationPrompt(request);
      const hasGlossary = prompt.includes("Glossary");
      expect(hasGlossary).toBe(false);
    });

    it("includes component context in prompt", () => {
      const request: AIRequest = {
        file: "src/LoginPage.tsx",
        componentContext: "Login Page component",
        element: "<h1>",
        surroundingCode: '  <h1>Welcome back</h1>',
        value: "Welcome back",
        keyStyle: "snake_case",
        glossary: {},
        targetLanguages: ["en"],
      };

      const prompt = buildTranslationPrompt(request);
      expect(prompt).toContain("Login Page");
    });
  });

  describe("parseAIResponse", () => {
    it("parses well-formed JSON response", () => {
      const json = JSON.stringify({
        key: "login.welcome_back",
        translations: {
          fr: "Bienvenue",
          es: "Bienvenido",
        },
      });

      const result = parseAIResponse(json);
      expect(result).toBeDefined();
      expect(result.key).toBe("login.welcome_back");
      expect(result.translations).toBeDefined();
    });

    it("extracts key from parsed response", () => {
      const json = JSON.stringify({
        key: "login.sign_in",
        translations: { fr: "Se connecter" },
      });

      const result = parseAIResponse(json);
      expect(result.key).toBe("login.sign_in");
    });

    it("includes translations in parsed response", () => {
      const json = JSON.stringify({
        key: "login.welcome_back",
        translations: {
          fr: "Bienvenue",
          es: "Bienvenido",
        },
      });

      const result = parseAIResponse(json);
      expect(result.translations).toBeDefined();
      expect(result.translations.fr).toBe("Bienvenue");
      expect(result.translations.es).toBe("Bienvenido");
    });

    it("throws for malformed JSON", () => {
      const malformed = "not valid json {]";

      expect(() => {
        parseAIResponse(malformed);
      }).toThrow();
    });

    it("throws for empty array", () => {
      const json = JSON.stringify([]);

      expect(() => {
        parseAIResponse(json);
      }).toThrow();
    });

    it("throws when missing required fields", () => {
      const json = JSON.stringify({
        key: "login.sign_in",
        // missing translations
      });

      expect(() => {
        parseAIResponse(json);
      }).toThrow();
    });

    it("tolerates leading/trailing whitespace around JSON", () => {
      const withWhitespace = `
      Some explanation text
      ${JSON.stringify({
        key: "login.sign_in",
        translations: { fr: "Se connecter" },
      })}
      More explanation text
      `;

      const result = parseAIResponse(withWhitespace);
      expect(result.key).toBe("login.sign_in");
    });
  });
});
