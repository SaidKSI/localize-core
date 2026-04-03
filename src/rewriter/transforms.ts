import type { ScanResult, I18nLibrary } from "../types.js";

// ─── Library adapter ─────────────────────────────────────────────────────────

/**
 * Encapsulates the library-specific details for import, hook, and call expression.
 * Each supported i18n library has its own adapter.
 */
export interface LibraryAdapter {
  /** npm package to import from */
  importSource: string;
  /** Named export to import: "useTranslation", "useTranslations", etc. */
  importSpecifier: string;
  /** The full import statement added to the top of the file */
  importStatement: string;
  /** Hook declaration added at the top of the component body */
  hookStatement: string;
  /**
   * A string that uniquely identifies this hook in source code.
   * Used to detect whether the hook is already present.
   */
  hookDetectionString: string;
  /** Build the call expression for a given i18n key, e.g. t('auth.login') */
  callFor(key: string): string;
}

export const LIBRARY_ADAPTERS: Record<I18nLibrary, LibraryAdapter> = {
  "react-i18next": {
    importSource: "react-i18next",
    importSpecifier: "useTranslation",
    importStatement: 'import { useTranslation } from "react-i18next";',
    hookStatement: "const { t } = useTranslation();",
    hookDetectionString: "useTranslation(",
    callFor: (key) => `t('${key}')`,
  },
  "i18next": {
    importSource: "react-i18next",
    importSpecifier: "useTranslation",
    importStatement: 'import { useTranslation } from "react-i18next";',
    hookStatement: "const { t } = useTranslation();",
    hookDetectionString: "useTranslation(",
    callFor: (key) => `t('${key}')`,
  },
  "next-intl": {
    importSource: "next-intl",
    importSpecifier: "useTranslations",
    importStatement: 'import { useTranslations } from "next-intl";',
    hookStatement: "const t = useTranslations();",
    hookDetectionString: "useTranslations(",
    callFor: (key) => `t('${key}')`,
  },
  "react-intl": {
    importSource: "react-intl",
    importSpecifier: "useIntl",
    importStatement: 'import { useIntl } from "react-intl";',
    hookStatement: "const intl = useIntl();",
    hookDetectionString: "useIntl(",
    callFor: (key) => `intl.formatMessage({ id: '${key}' })`,
  },
  "vue-i18n": {
    importSource: "vue-i18n",
    importSpecifier: "useI18n",
    importStatement: 'import { useI18n } from "vue-i18n";',
    hookStatement: "const { t } = useI18n();",
    hookDetectionString: "useI18n(",
    callFor: (key) => `t('${key}')`,
  },
};

export function getAdapter(library: I18nLibrary): LibraryAdapter {
  return LIBRARY_ADAPTERS[library];
}

// ─── Positional string replacement ───────────────────────────────────────────

/**
 * Apply all resolved string replacements to the source text.
 *
 * Strategy:
 * - Sort results bottom-to-top, right-to-left so earlier replacements
 *   don't shift the positions of later ones on the same line.
 * - For each result, locate the exact source span from its NodeType and
 *   replace it with the appropriate t() call expression.
 */
export function applyStringReplacements(
  source: string,
  results: ScanResult[],
  adapter: LibraryAdapter,
): { modified: string; count: number } {
  const resolved = results.filter((r) => r.resolvedKey !== null);
  if (resolved.length === 0) return { modified: source, count: 0 };

  // Sort: bottom → top, right → left
  const sorted = [...resolved].sort((a, b) => {
    if (b.line !== a.line) return b.line - a.line;
    return b.column - a.column;
  });

  const lines = source.split("\n");
  let count = 0;

  for (const result of sorted) {
    const lineIdx = result.line - 1; // convert to 0-based
    const lineStr = lines[lineIdx];
    if (lineStr === undefined) continue;

    const key = result.resolvedKey!;
    const call = adapter.callFor(key);
    let replaced: string | null = null;

    switch (result.nodeType) {
      case "JSXText": {
        // Bare text: Welcome back → {t('key')}
        // Search for the trimmed value starting at (or after) the column
        const idx = lineStr.indexOf(result.value, result.column);
        if (idx !== -1) {
          replaced =
            lineStr.substring(0, idx) +
            `{${call}}` +
            lineStr.substring(idx + result.value.length);
        }
        break;
      }

      case "JSXAttribute": {
        // Quoted attribute value: "Enter email" or 'Enter email' → {t('key')}
        // Try both quote styles; column points to the opening quote
        for (const q of ['"', "'"] as const) {
          const target = `${q}${result.value}${q}`;
          const idx = lineStr.indexOf(target, result.column);
          if (idx !== -1) {
            replaced =
              lineStr.substring(0, idx) +
              `{${call}}` +
              lineStr.substring(idx + target.length);
            break;
          }
        }
        break;
      }

      case "TemplateLiteral": {
        if (result.context === "Template literal (static part)") {
          // Static quasi from a dynamic template: `prefix ${expr} suffix`
          // Replace just the static text span with ${t('key')} (stays inside backticks)
          const idx = lineStr.indexOf(result.value, result.column);
          if (idx !== -1) {
            replaced =
              lineStr.substring(0, idx) +
              `\${${call}}` +
              lineStr.substring(idx + result.value.length);
          }
        } else {
          // Standalone static template literal: `Hello world` → t('key')
          const target = `\`${result.value}\``;
          const idx = lineStr.indexOf(target, result.column);
          if (idx !== -1) {
            replaced =
              lineStr.substring(0, idx) +
              call +
              lineStr.substring(idx + target.length);
          }
        }
        break;
      }

      case "StringLiteral": {
        // Skip module-level strings — t() is not available outside component functions
        if (result.isModuleLevel) break;
        // Non-JSX string inside component: setError("..."), return "..." etc. → t('key')
        for (const q of ['"', "'"] as const) {
          const target = `${q}${result.value}${q}`;
          const idx = lineStr.indexOf(target, result.column);
          if (idx !== -1) {
            replaced =
              lineStr.substring(0, idx) +
              call +
              lineStr.substring(idx + target.length);
            break;
          }
        }
        break;
      }

      case "JSXInterpolation": {
        // Replace the entire children span with a single t() call that passes
        // the interpolation variables as an object:
        //   You have {taskCount} pending tasks
        //   → {t('tasks.pending_count', { taskCount: taskCount })}
        if (!result.rawSpan || !result.interpolations?.length) break;

        // Build the options object: { taskCount: taskCount, userName: userName }
        const argsStr = result.interpolations
          .map(({ placeholder, expression }) =>
            placeholder === expression
              ? placeholder                        // shorthand: { taskCount }
              : `${placeholder}: ${expression}`,   // aliased: { count: taskCount }
          )
          .join(", ");

        const callWithArgs = adapter.callFor(key).replace(
          /\)$/,
          `, { ${argsStr} })`,
        );

        // rawSpan may include surrounding newlines/whitespace from JSX formatting
        // (the scanner's firstChild.getStart() lands on the '\n' after the opening
        // tag's '>').  Trim first, then search on the reported line.
        // Try column-anchored search first; fall back to scanning from col 0
        // because result.column may point to the prior line's position.
        const rawSpanTrimmed = result.rawSpan.trim();
        // If trimmed span still contains a newline the content truly spans
        // multiple lines — indexOf on a single lineStr will return -1 safely.
        let idx = lineStr.indexOf(rawSpanTrimmed, result.column);
        if (idx === -1) idx = lineStr.indexOf(rawSpanTrimmed, 0);
        if (idx !== -1) {
          replaced =
            lineStr.substring(0, idx) +
            `{${callWithArgs}}` +
            lineStr.substring(idx + rawSpanTrimmed.length);
        }
        break;
      }
    }

    if (replaced !== null) {
      lines[lineIdx] = replaced;
      count++;
    }
  }

  return { modified: lines.join("\n"), count };
}
