import { Project, Node, SyntaxKind } from "ts-morph";
import type { LibraryAdapter } from "./transforms.js";

// ─── Import injection ─────────────────────────────────────────────────────────

/**
 * Ensure the i18n library import exists in the file.
 * If the import (or specifier) is already present, the source is returned unchanged.
 * Otherwise the import is added after the last existing import declaration.
 */
export function ensureImport(
  source: string,
  filePath: string,
  adapter: LibraryAdapter,
): string {
  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });

  // Check if the import already exists
  const existing = sf.getImportDeclaration(
    (d) =>
      d.getModuleSpecifierValue() === adapter.importSource &&
      d.getNamedImports().some((n) => n.getName() === adapter.importSpecifier),
  );

  if (existing) return source; // already imported

  // Check if the module is imported but our specifier is missing
  const partialImport = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === adapter.importSource,
  );

  if (partialImport) {
    // Add our specifier to the existing import
    partialImport.addNamedImport(adapter.importSpecifier);
  } else {
    // Add a brand new import declaration after all existing imports
    const imports = sf.getImportDeclarations();
    const insertIndex =
      imports.length > 0
        ? imports[imports.length - 1]!.getChildIndex() + 1
        : 0;

    sf.insertImportDeclaration(insertIndex, {
      namedImports: [adapter.importSpecifier],
      moduleSpecifier: adapter.importSource,
    });
  }

  return sf.getFullText();
}

// ─── Hook injection ───────────────────────────────────────────────────────────

/**
 * Find the first component function in the source file.
 * Looks for:
 * 1. Exported function declarations: `export function Login()`
 * 2. Default export functions: `export default function()`
 * 3. Exported arrow function variable declarations: `export const Login = () => {}`
 * 4. Any arrow function variable declaration: `const Login = () => {}`
 * 5. Fallback: any function declaration
 *
 * Returns null if no suitable function is found.
 */
function findComponentFunction(sf: ReturnType<Project["createSourceFile"]>) {
  // 1. Named exported function declarations
  for (const fn of sf.getFunctions()) {
    if (fn.isExported() || fn.isDefaultExport()) return fn;
  }

  // 2. Exported arrow function variable declarations
  for (const varStmt of sf.getVariableStatements()) {
    if (!varStmt.isExported()) continue;
    for (const decl of varStmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && Node.isArrowFunction(init)) {
        return init;
      }
    }
  }

  // 3. Any arrow function variable declaration
  for (const varStmt of sf.getVariableStatements()) {
    for (const decl of varStmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (init && Node.isArrowFunction(init)) {
        return init;
      }
    }
  }

  // 4. Fallback: first function declaration in file
  return sf.getFunctions()[0] ?? null;
}

/**
 * Ensure the translation hook declaration exists in the first component function.
 * If the hook call is already present anywhere in the file, the source is returned unchanged.
 * Otherwise the hook statement is inserted at the top of the component function body.
 */
export function ensureHook(
  source: string,
  filePath: string,
  adapter: LibraryAdapter,
  namespace?: string,
): string {
  // Fast path: hook already present in source text
  if (source.includes(adapter.hookDetectionString)) return source;

  const project = new Project({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(filePath, source, { overwrite: true });

  const fn = findComponentFunction(sf);
  if (!fn) return source; // no function found — leave as-is

  const body = Node.isArrowFunction(fn)
    ? fn.getBody()
    : (fn as ReturnType<typeof sf.getFunctions>[number]).getBody();

  if (!body) return source;

  // For arrow functions with expression bodies (no braces), convert to block first
  if (!Node.isBlock(body)) {
    // e.g. `const X = () => <div/>` — not common in real components, skip
    return source;
  }

  // Build the hook statement, using namespace if provided and if the hook accepts it
  // Only useTranslation, useTranslations, and useI18n accept namespace argument.
  // react-intl's useIntl() does not accept a namespace argument.
  const supportsNamespace = adapter.importSpecifier !== "useIntl";
  const hookStatement = namespace && supportsNamespace
    ? adapter.hookStatement.replace("()", `('${namespace}')`)
    : adapter.hookStatement;

  // Insert hook at the very beginning of the function body (index 0)
  body.insertStatements(0, [hookStatement]);

  return sf.getFullText();
}

// ─── Combined ────────────────────────────────────────────────────────────────

/**
 * Apply both import and hook injection in a single pass.
 * Import is added first so the hook injection sees the updated source.
 */
export function ensureTranslationBoilerplate(
  source: string,
  filePath: string,
  adapter: LibraryAdapter,
  namespace?: string,
): string {
  let result = ensureImport(source, filePath, adapter);
  result = ensureHook(result, filePath, adapter, namespace);
  return result;
}
