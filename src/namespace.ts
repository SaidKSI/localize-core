import { basename, extname } from "path";

/**
 * Given a list of absolute source file paths, return a Map<filePath, namespace>
 * where each namespace is the lowercased filename without extension.
 *
 * When two files share the same base name (e.g., src/Header.tsx and src/admin/Header.tsx),
 * the first occurrence keeps the plain name ("header") and subsequent ones get a numeric
 * suffix: "header_1", "header_2", etc.
 *
 * The order of the input array determines which file wins the plain name.
 *
 * @example
 * resolveNamespaces(["/src/Header.tsx", "/admin/Header.tsx"])
 * // → Map { "/src/Header.tsx" → "header", "/admin/Header.tsx" → "header_1" }
 */
export function resolveNamespaces(filePaths: string[]): Map<string, string> {
  const result = new Map<string, string>();
  // nextSuffix tracks the next numeric suffix to assign for each base name
  const nextSuffix = new Map<string, number>();

  for (const filePath of filePaths) {
    const base = basename(filePath, extname(filePath)).toLowerCase();
    const suffix = nextSuffix.get(base) ?? 0;

    // First occurrence → plain name; subsequent → base_1, base_2, ...
    result.set(filePath, suffix === 0 ? base : `${base}_${suffix}`);
    nextSuffix.set(base, suffix + 1);
  }

  return result;
}

/**
 * Convenience wrapper: get the namespace for a single file given all files
 * in the same batch (for collision detection).
 * Falls back to the lowercased basename if `filePath` is not in `allFilePaths`.
 */
export function getNamespaceForFile(
  filePath: string,
  allFilePaths: string[],
): string {
  const map = resolveNamespaces(allFilePaths);
  return map.get(filePath) ?? basename(filePath, extname(filePath)).toLowerCase();
}
