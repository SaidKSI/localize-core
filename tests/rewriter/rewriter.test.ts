import { describe, it, expect } from "vitest";
import { generateDiff, groupResultsByFile } from "../../src/rewriter/index.js";
import type { ScanResult } from "../../src/types.js";

describe("rewriter", () => {
  describe("generateDiff", () => {
    it("returns empty string when content is identical", () => {
      const original = "export function Page() {\n  return <div>Hello</div>;\n}";
      const modified = original;

      const diff = generateDiff(original, modified, "src/Page.tsx");
      expect(diff).toBe("");
    });

    it("shows changes with +/- prefixes", () => {
      const original = "export function Page() {\n  return <div>Hello</div>;\n}";
      const modified = 'export function Page() {\n  const { t } = useTranslation();\n  return <div>{t("page.hello")}</div>;\n}';

      const diff = generateDiff(original, modified, "src/Page.tsx");
      expect(diff).toContain("+");
      expect(diff).toContain("-");
    });

    it("includes file path in diff header", () => {
      const original = "line 1\nline 2\nline 3";
      const modified = "line 1\nmodified\nline 3";

      const diff = generateDiff(original, modified, "src/Test.tsx");
      expect(diff).toContain("src/Test.tsx");
    });

    it("shows context lines around changes", () => {
      const original = "line 1\nline 2\nline 3\nline 4\nline 5";
      const modified = "line 1\nline 2\nMODIFIED\nline 4\nline 5";

      const diff = generateDiff(original, modified, "src/Test.tsx");
      // Context should include lines around the change
      expect(diff).toContain("line 2");
      expect(diff).toContain("line 4");
    });

    it("handles adding lines", () => {
      const original = "line 1\nline 3";
      const modified = "line 1\nline 2\nline 3";

      const diff = generateDiff(original, modified, "src/Test.tsx");
      expect(diff).toContain("+");
    });

    it("handles removing lines", () => {
      const original = "line 1\nline 2\nline 3";
      const modified = "line 1\nline 3";

      const diff = generateDiff(original, modified, "src/Test.tsx");
      expect(diff).toContain("-");
    });

    it("shows gap separator (@@) for non-contiguous changes", () => {
      const original = [
        "line 1",
        "line 2",
        "line 3",
        "line 4",
        "line 5",
        "line 6",
        "line 7",
        "line 8",
        "line 9",
        "line 10",
      ].join("\n");
      const modified = [
        "CHANGED1",
        "line 2",
        "line 3",
        "line 4",
        "line 5",
        "line 6",
        "line 7",
        "line 8",
        "CHANGED2",
        "line 10",
      ].join("\n");

      const diff = generateDiff(original, modified, "src/Test.tsx");
      expect(diff).toContain("@@");
    });
  });

  describe("groupResultsByFile", () => {
    it("returns empty map for empty results", () => {
      const grouped = groupResultsByFile([]);
      expect(grouped).toBeInstanceOf(Map);
      expect(grouped.size).toBe(0);
    });

    it("groups results by file path", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "Hello",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Hello</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page1.hello",
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page1.tsx",
          line: 2,
          column: 0,
          value: "World",
          nodeType: "JSXText",
          context: "JSXText inside <p>",
          surroundingCode: "<p>World</p>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page1.world",
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 1,
          column: 0,
          value: "Goodbye",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Goodbye</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page2.goodbye",
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const grouped = groupResultsByFile(results);

      expect(grouped.size).toBe(2);
      expect(grouped.has("src/Page1.tsx")).toBe(true);
      expect(grouped.has("src/Page2.tsx")).toBe(true);
    });

    it("each group contains correct results", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page1.tsx",
          line: 1,
          column: 0,
          value: "Hello",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Hello</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page1.hello",
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page1.tsx",
          line: 2,
          column: 0,
          value: "World",
          nodeType: "JSXText",
          context: "JSXText inside <p>",
          surroundingCode: "<p>World</p>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page1.world",
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page2.tsx",
          line: 1,
          column: 0,
          value: "Goodbye",
          nodeType: "JSXText",
          context: "JSXText inside <h1>",
          surroundingCode: "<h1>Goodbye</h1>",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: "page2.goodbye",
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const grouped = groupResultsByFile(results);
      const page1Results = grouped.get("src/Page1.tsx");
      const page2Results = grouped.get("src/Page2.tsx");

      expect(page1Results).toHaveLength(2);
      expect(page2Results).toHaveLength(1);
      expect(page1Results?.[0]?.value).toBe("Hello");
      expect(page1Results?.[1]?.value).toBe("World");
      expect(page2Results?.[0]?.value).toBe("Goodbye");
    });

    it("maintains result order within each group", () => {
      const results: ScanResult[] = [
        {
          file: "src/Page.tsx",
          line: 10,
          column: 0,
          value: "Third",
          nodeType: "JSXText",
          context: "JSXText",
          surroundingCode: "",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page.tsx",
          line: 5,
          column: 0,
          value: "First",
          nodeType: "JSXText",
          context: "JSXText",
          surroundingCode: "",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
        {
          file: "src/Page.tsx",
          line: 8,
          column: 0,
          value: "Second",
          nodeType: "JSXText",
          context: "JSXText",
          surroundingCode: "",
          alreadyTranslated: false,
          isModuleLevel: false,
          resolvedKey: null,
          interpolations: [],
          rawSpan: [0, 10],
        },
      ];

      const grouped = groupResultsByFile(results);
      const pageResults = grouped.get("src/Page.tsx");

      // Results should be in the order they were added
      expect(pageResults?.[0]?.value).toBe("Third");
      expect(pageResults?.[1]?.value).toBe("First");
      expect(pageResults?.[2]?.value).toBe("Second");
    });
  });
});
