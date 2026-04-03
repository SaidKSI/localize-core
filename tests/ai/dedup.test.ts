import { describe, it, expect } from "vitest";
import {
  deduplicateResults,
  buildAIRequests,
  applyResolvedKeys,
} from "../../src/ai/dedup.js";
import type { ScanResult } from "../../src/types.js";
import { makeConfig } from "../helpers/config.js";

describe("dedup", () => {
  describe("deduplicateResults", () => {
    it("returns empty map for empty input", () => {
      const result = deduplicateResults([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("groups identical values together", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 2,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped.size).toBe(1);
      expect(deduped.has("Welcome")).toBe(true);
      expect(deduped.get("Welcome")).toHaveLength(2);
    });

    it("treats different strings separately", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 2,
          column: 0,
          value: "Goodbye",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Goodbye</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped.size).toBe(2);
      expect(deduped.get("Welcome")).toHaveLength(1);
      expect(deduped.get("Goodbye")).toHaveLength(1);
    });

    it("deduplication is case-sensitive", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 2,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const deduped = deduplicateResults(results);
      expect(deduped.size).toBe(2);
      expect(deduped.has("welcome")).toBe(true);
      expect(deduped.has("Welcome")).toBe(true);
    });
  });

  describe("buildAIRequests", () => {
    it("builds one request per deduplicated group", () => {
      const groups = new Map<string, ScanResult[]>([
        [
          "Welcome",
          [
            {
              file: "src/Page.tsx",
              line: 1,
              column: 0,
              value: "Welcome",
              nodeType: "JSXText",
              context: "JSXText inside <h1>",
              surroundingCode: "<h1>Welcome</h1>",
              alreadyTranslated: false,
              isModuleLevel: false,
              resolvedKey: null,
              interpolations: [],
              rawSpan: [0, 10],
            },
          ],
        ],
      ]);

      const config = makeConfig();
      const requests = buildAIRequests(groups, config);

      expect(requests).toHaveLength(1);
      expect(requests[0]?.value).toBe("Welcome");
    });

    it("includes correct config fields in request", () => {
      const groups = new Map<string, ScanResult[]>([
        [
          "Welcome",
          [
            {
              file: "src/Page.tsx",
              line: 1,
              column: 0,
              value: "Welcome",
              nodeType: "JSXText",
              context: "JSXText inside <h1>",
              surroundingCode: "<h1>Welcome</h1>",
              alreadyTranslated: false,
              isModuleLevel: false,
              resolvedKey: null,
              interpolations: [],
              rawSpan: [0, 10],
            },
          ],
        ],
      ]);

      const config = makeConfig({
        keyStyle: "dot.notation",
        languages: ["fr", "es"],
      });
      const requests = buildAIRequests(groups, config);

      expect(requests[0]?.keyStyle).toBe("dot.notation");
      expect(requests[0]?.targetLanguages).toEqual(["fr", "es"]);
    });

    it("derives component context from file path", () => {
      const groups = new Map<string, ScanResult[]>([
        [
          "Welcome",
          [
            {
              file: "src/pages/LoginPage.tsx",
              line: 1,
              column: 0,
              value: "Welcome",
              nodeType: "JSXText",
              context: "JSXText inside <h1>",
              surroundingCode: "<h1>Welcome</h1>",
              alreadyTranslated: false,
              isModuleLevel: false,
              resolvedKey: null,
              interpolations: [],
              rawSpan: [0, 10],
            },
          ],
        ],
      ]);

      const config = makeConfig();
      const requests = buildAIRequests(groups, config);

      expect(requests[0]?.componentContext).toBeDefined();
      expect(requests[0]?.componentContext).toContain("Login");
    });

    it("includes glossary entries for matched strings", () => {
      const groups = new Map<string, ScanResult[]>([
        [
          "Settings",
          [
            {
              file: "src/Page.tsx",
              line: 1,
              column: 0,
              value: "Settings",
              nodeType: "JSXText",
              context: "JSXText inside <h1>",
              surroundingCode: "<h1>Settings</h1>",
              alreadyTranslated: false,
              isModuleLevel: false,
              resolvedKey: null,
              interpolations: [],
              rawSpan: [0, 10],
            },
          ],
        ],
      ]);

      const config = makeConfig({
        glossary: {
          fr: { Settings: "Paramètres" },
        },
      });
      const requests = buildAIRequests(groups, config);

      expect(requests[0]?.glossary).toBeDefined();
      expect(requests[0]?.glossary?.fr).toBe("Paramètres");
    });

    it("skips glossary entries for unmatched strings", () => {
      const groups = new Map<string, ScanResult[]>([
        [
          "Welcome",
          [
            {
              file: "src/Page.tsx",
              line: 1,
              column: 0,
              value: "Welcome",
              nodeType: "JSXText",
              context: "JSXText inside <h1>",
              surroundingCode: "<h1>Welcome</h1>",
              alreadyTranslated: false,
              isModuleLevel: false,
              resolvedKey: null,
              interpolations: [],
              rawSpan: [0, 10],
            },
          ],
        ],
      ]);

      const config = makeConfig({
        glossary: {
          fr: { Settings: "Paramètres" },
        },
      });
      const requests = buildAIRequests(groups, config);

      expect(requests[0]?.glossary).toEqual({});
    });
  });

  describe("applyResolvedKeys", () => {
    it("applies keys to all results with matching value", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 2,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const responses = new Map([["Welcome", "login.welcome_back"]]);
      const updated = applyResolvedKeys(results, responses);

      expect(updated).toHaveLength(2);
      expect(updated[0]?.resolvedKey).toBe("login.welcome_back");
      expect(updated[1]?.resolvedKey).toBe("login.welcome_back");
    });

    it("does not modify original results array", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page.tsx",
          line: 1,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const responses = new Map([["Welcome", "login.welcome_back"]]);
      const updated = applyResolvedKeys(results, responses);

      expect(results[0]?.resolvedKey).toBeNull();
      expect(updated[0]?.resolvedKey).toBe("login.welcome_back");
    });

    it("sets resolvedKey to null for unmapped values", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page.tsx",
          line: 1,
          column: 0,
          value: "Welcome",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Welcome</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const responses = new Map([["Goodbye", "login.goodbye"]]);
      const updated = applyResolvedKeys(results, responses);

      expect(updated[0]?.resolvedKey).toBeNull();
    });
  });
});
