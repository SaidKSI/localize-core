import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import {
  hashSource,
  isCached,
  markCached,
  evictEntry,
  filterUncached,
  markBatchCached,
  readCache,
  writeCache,
  clearCache,
} from "../../src/cache/index.js";
import type { CacheStore } from "../../src/types.js";

describe("cache", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), `.test-cache-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("hashSource", () => {
    it("returns a 64-character hex string", () => {
      const hash = hashSource("hello world");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64);
    });

    it("returns same hash for identical input", () => {
      const input = "the quick brown fox";
      const hash1 = hashSource(input);
      const hash2 = hashSource(input);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different input", () => {
      const hash1 = hashSource("string1");
      const hash2 = hashSource("string2");
      expect(hash1).not.toBe(hash2);
    });

    it("is deterministic", () => {
      const input = "test content";
      const hashes = [
        hashSource(input),
        hashSource(input),
        hashSource(input),
      ];
      expect(hashes[0]).toBe(hashes[1]);
      expect(hashes[1]).toBe(hashes[2]);
    });

    it("handles empty string", () => {
      const hash = hashSource("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64);
    });

    it("handles multiline content", () => {
      const content = "line1\nline2\nline3";
      const hash = hashSource(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("isCached", () => {
    it("returns false for empty store", () => {
      const store: CacheStore = { version: 1, entries: {} };
      const result = isCached(store, "src/Page.tsx", "const x = 1;");
      expect(result).toBe(false);
    });

    it("returns false for missing file", () => {
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Other.tsx": { hash: hashSource("old"), stringCount: 5 },
        },
      };
      const result = isCached(store, "src/Page.tsx", "const x = 1;");
      expect(result).toBe(false);
    });

    it("returns false for mismatched hash", () => {
      const source = "const x = 1;";
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Page.tsx": { hash: hashSource("different"), stringCount: 5 },
        },
      };
      const result = isCached(store, "src/Page.tsx", source);
      expect(result).toBe(false);
    });

    it("returns true for matching file and hash", () => {
      const source = "const x = 1;";
      const hash = hashSource(source);
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Page.tsx": { hash, stringCount: 5 },
        },
      };
      const result = isCached(store, "src/Page.tsx", source);
      expect(result).toBe(true);
    });
  });

  describe("markCached", () => {
    it("returns new store without mutating original", () => {
      const original: CacheStore = { version: 1, entries: {} };
      const source = "const x = 1;";

      const updated = markCached(original, "src/Page.tsx", source, 5);

      expect(original.entries).toEqual({});
      expect(updated.entries["src/Page.tsx"]).toBeDefined();
    });

    it("stores file hash and string count", () => {
      const store: CacheStore = { version: 1, entries: {} };
      const source = "const x = 1;";
      const hash = hashSource(source);

      const updated = markCached(store, "src/Page.tsx", source, 5);

      expect(updated.entries["src/Page.tsx"]?.hash).toBe(hash);
      expect(updated.entries["src/Page.tsx"]?.stringCount).toBe(5);
    });

    it("isCached returns true after marking", () => {
      let store: CacheStore = { version: 1, entries: {} };
      const source = "const x = 1;";

      store = markCached(store, "src/Page.tsx", source, 5);
      const result = isCached(store, "src/Page.tsx", source);

      expect(result).toBe(true);
    });

    it("overwrites existing entry", () => {
      const source1 = "old content";
      const source2 = "new content";
      const hash2 = hashSource(source2);

      let store: CacheStore = { version: 1, entries: {} };
      store = markCached(store, "src/Page.tsx", source1, 3);
      store = markCached(store, "src/Page.tsx", source2, 7);

      expect(store.entries["src/Page.tsx"]?.hash).toBe(hash2);
      expect(store.entries["src/Page.tsx"]?.stringCount).toBe(7);
    });
  });

  describe("evictEntry", () => {
    it("returns new store without mutating original", () => {
      const source = "const x = 1;";
      const original: CacheStore = {
        version: 1,
        entries: {
          "src/Page.tsx": { hash: hashSource(source), stringCount: 5 },
        },
      };

      const updated = evictEntry(original, "src/Page.tsx");

      expect(original.entries["src/Page.tsx"]).toBeDefined();
      expect(updated.entries["src/Page.tsx"]).toBeUndefined();
    });

    it("does nothing for non-existent file", () => {
      const store: CacheStore = { version: 1, entries: {} };
      const result = evictEntry(store, "src/NonExistent.tsx");
      expect(result.entries).toEqual({});
    });

    it("isCached returns false after eviction", () => {
      const source = "const x = 1;";
      let store: CacheStore = {
        version: 1,
        entries: {
          "src/Page.tsx": { hash: hashSource(source), stringCount: 5 },
        },
      };

      store = evictEntry(store, "src/Page.tsx");
      const result = isCached(store, "src/Page.tsx", source);

      expect(result).toBe(false);
    });

    it("preserves other entries", () => {
      const source1 = "source 1";
      const source2 = "source 2";
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Page1.tsx": { hash: hashSource(source1), stringCount: 5 },
          "src/Page2.tsx": { hash: hashSource(source2), stringCount: 3 },
        },
      };

      const updated = evictEntry(store, "src/Page1.tsx");

      expect(updated.entries["src/Page1.tsx"]).toBeUndefined();
      expect(updated.entries["src/Page2.tsx"]).toBeDefined();
    });
  });

  describe("filterUncached", () => {
    it("returns all files for empty store", () => {
      const store: CacheStore = { version: 1, entries: {} };
      const files = [
        { relPath: "src/Page1.tsx", source: "content1" },
        { relPath: "src/Page2.tsx", source: "content2" },
      ];

      const result = filterUncached(store, files);

      expect(result).toEqual(files);
    });

    it("filters out cached files", () => {
      const source = "const x = 1;";
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Page1.tsx": { hash: hashSource(source), stringCount: 5 },
        },
      };
      const files = [
        { relPath: "src/Page1.tsx", source },
        { relPath: "src/Page2.tsx", source: "different" },
      ];

      const result = filterUncached(store, files);

      expect(result).toHaveLength(1);
      expect(result[0]?.relPath).toBe("src/Page2.tsx");
    });

    it("handles mixed cached and uncached files", () => {
      const source1 = "content1";
      const source2 = "content2";
      const store: CacheStore = {
        version: 1,
        entries: {
          "src/Page1.tsx": { hash: hashSource(source1), stringCount: 5 },
          "src/Page3.tsx": { hash: hashSource("cached3"), stringCount: 2 },
        },
      };
      const files = [
        { relPath: "src/Page1.tsx", source: source1 },
        { relPath: "src/Page2.tsx", source: source2 },
        { relPath: "src/Page3.tsx", source: "different" },
      ];

      const result = filterUncached(store, files);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.relPath)).toContain("src/Page2.tsx");
      expect(result.map((f) => f.relPath)).toContain("src/Page3.tsx");
    });
  });

  describe("markBatchCached", () => {
    it("marks all items in batch as cached", () => {
      let store: CacheStore = { version: 1, entries: {} };
      const batch = [
        { relPath: "src/Page1.tsx", source: "content1", stringCount: 3 },
        { relPath: "src/Page2.tsx", source: "content2", stringCount: 5 },
      ];

      store = markBatchCached(store, batch);

      expect(isCached(store, "src/Page1.tsx", "content1")).toBe(true);
      expect(isCached(store, "src/Page2.tsx", "content2")).toBe(true);
    });

    it("does not mutate original store", () => {
      const original: CacheStore = { version: 1, entries: {} };
      const batch = [{ relPath: "src/Page.tsx", source: "content", stringCount: 3 }];

      const updated = markBatchCached(original, batch);

      expect(original.entries).toEqual({});
      expect(updated.entries["src/Page.tsx"]).toBeDefined();
    });

    it("handles empty batch", () => {
      const store: CacheStore = { version: 1, entries: {} };
      const result = markBatchCached(store, []);
      expect(result.entries).toEqual({});
    });

    it("preserves existing entries", () => {
      const source1 = "existing";
      let store: CacheStore = {
        version: 1,
        entries: {
          "src/Existing.tsx": { hash: hashSource(source1), stringCount: 2 },
        },
      };

      const batch = [{ relPath: "src/New.tsx", source: "new", stringCount: 3 }];
      store = markBatchCached(store, batch);

      expect(store.entries["src/Existing.tsx"]).toBeDefined();
      expect(store.entries["src/New.tsx"]).toBeDefined();
    });
  });

  describe("readCache", () => {
    it("returns empty store when file does not exist", async () => {
      const result = await readCache(tempDir);

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.entries).toEqual({});
    });
  });

  describe("writeCache + readCache round-trip", () => {
    it("persists and retrieves cache data", async () => {
      let store: CacheStore = { version: 1, entries: {} };
      store = markCached(store, "src/Page.tsx", "content", 5);

      await writeCache(tempDir, store);
      const retrieved = await readCache(tempDir);

      expect(retrieved.entries["src/Page.tsx"]).toBeDefined();
      expect(retrieved.entries["src/Page.tsx"]?.stringCount).toBe(5);
    });

    it("creates .localizer directory if missing", async () => {
      const store: CacheStore = { version: 1, entries: {} };
      await writeCache(tempDir, store);

      // Should not throw
      const retrieved = await readCache(tempDir);
      expect(retrieved).toBeDefined();
    });

    it("preserves multiple entries", async () => {
      let store: CacheStore = { version: 1, entries: {} };
      store = markCached(store, "src/Page1.tsx", "content1", 3);
      store = markCached(store, "src/Page2.tsx", "content2", 5);

      await writeCache(tempDir, store);
      const retrieved = await readCache(tempDir);

      expect(Object.keys(retrieved.entries)).toHaveLength(2);
      expect(retrieved.entries["src/Page1.tsx"]).toBeDefined();
      expect(retrieved.entries["src/Page2.tsx"]).toBeDefined();
    });
  });

  describe("clearCache", () => {
    it("deletes the cache file", async () => {
      const store: CacheStore = { version: 1, entries: {} };
      await writeCache(tempDir, store);

      await clearCache(tempDir);
      const retrieved = await readCache(tempDir);

      expect(retrieved.entries).toEqual({});
    });

    it("does not throw when cache file does not exist", async () => {
      // Should not throw
      await clearCache(tempDir);
    });

    it("subsequent readCache returns empty store after clear", async () => {
      let store: CacheStore = { version: 1, entries: {} };
      store = markCached(store, "src/Page.tsx", "content", 5);
      await writeCache(tempDir, store);

      await clearCache(tempDir);
      const retrieved = await readCache(tempDir);

      expect(retrieved.entries).toEqual({});
    });
  });
});
