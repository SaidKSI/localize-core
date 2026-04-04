// Types — import these in all modules
export * from "./types.js";

// Namespace resolution
export { resolveNamespaces, getNamespaceForFile } from "./namespace.js";

// Scanner
export { scanFile, scanFiles, scanDirectory, buildScanReport } from "./scanner/index.js";
export { shouldFilter, NON_TRANSLATABLE_ATTRS, TRANSLATION_FNS } from "./scanner/filters.js";

// Rewriter — Step 6
export * from "./rewriter/index.js";

// AI client — Step 5
export * from "./ai/index.js";

// Validator — Step 7
export {
  flattenKeys,
  readLanguageKeys,
  validateCoverage,
  isFullyCovered,
  getMissingKeys,
  resolveKeysFromMessages,
  type ValidateOptions,
} from "./validator/index.js";

// Cache — Step 8
export * from "./cache/index.js";
