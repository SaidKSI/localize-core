import type { AIRequest } from "../types.js";

// ─── Language names ───────────────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  zh: "Chinese (Simplified)",
  ko: "Korean",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  sv: "Swedish",
  da: "Danish",
  fi: "Finnish",
  nb: "Norwegian",
  cs: "Czech",
  hu: "Hungarian",
  ro: "Romanian",
  uk: "Ukrainian",
  he: "Hebrew",
  hi: "Hindi",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildTranslationPrompt(request: AIRequest): string {
  const {
    file,
    componentContext,
    element,
    surroundingCode,
    value,
    keyStyle,
    glossary,
    targetLanguages,
  } = request;

  const indentedCode = surroundingCode
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");

  const glossarySection =
    Object.keys(glossary).length > 0
      ? `Glossary (use these exact terms):\n${Object.entries(glossary)
          .map(([lang, term]) => `  ${lang}: "${term}"`)
          .join("\n")}\n\n`
      : "";

  const relatedStringsSection =
    request.relatedStrings && request.relatedStrings.length > 0
      ? `Related strings in same component (for consistent naming):\n${request.relatedStrings
          .slice(0, 5)
          .map((s) => `  "${s}"`)
          .join("\n")}\n\n`
      : "";

  const languageList = targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(", ");

  const exampleKey =
    keyStyle === "dot.notation"
      ? "section.descriptive_key"
      : "section_descriptive_key";

  const exampleTranslations = Object.fromEntries(
    targetLanguages.map((lang) => [lang, "..."]),
  );

  // Detect whether this string contains i18next interpolation placeholders
  const hasInterpolation = /\{\{[^}]+\}\}/.test(value);
  const interpolationRule = hasInterpolation
    ? `- This string contains i18next interpolation placeholders like {{count}}. Preserve ALL {{placeholder}} tokens exactly as-is in every translation — do NOT translate, rename, or remove them.\n`
    : "";

  return `You are an i18n key naming and translation assistant.

File: ${file}
Component: ${componentContext}
Element: ${element}
Surrounding code:
${indentedCode}

String: "${value}"
Key style: ${keyStyle}
${glossarySection}${relatedStringsSection}Tasks:
1. Generate a concise semantic i18n key in ${keyStyle} format
2. Translate the string into: ${languageList}

Rules:
- Key must be lowercase and context-aware (e.g. "auth.sign_in_button", not "button1")
- If related strings exist in the same component, use consistent namespace roots (e.g. all under "dashboard.statistics" not mixed namespaces)
- Use glossary terms exactly when provided
- Translations must be natural, not word-for-word literal
${interpolationRule}- Return ONLY valid JSON — no explanation, no markdown fences

Return exactly this shape:
{ "key": "${exampleKey}", "translations": ${JSON.stringify(exampleTranslations)} }`;
}

// ─── Translation-only prompt (--from-existing) ───────────────────────────────

/**
 * Simpler prompt used when keys already exist and we only need translations.
 * Returns a flat { lang: translation } object — no key generation.
 */
export function buildTranslationOnlyPrompt(
  value: string,
  targetLanguages: string[],
  glossary: Record<string, string> = {},
): string {
  const languageList = targetLanguages
    .map((code) => `${getLanguageName(code)} (${code})`)
    .join(", ");

  const glossarySection =
    Object.keys(glossary).length > 0
      ? `Glossary (use these exact terms):\n${Object.entries(glossary)
          .map(([lang, term]) => `  ${lang}: "${term}"`)
          .join("\n")}\n\n`
      : "";

  const example = Object.fromEntries(targetLanguages.map((l) => [l, "..."]));

  return `You are a professional translator.

String: "${value}"
Translate into: ${languageList}
${glossarySection}Rules:
- Translations must be natural, not word-for-word literal
- Use glossary terms exactly when provided
- Return ONLY valid JSON with no explanation or markdown

Return exactly:
${JSON.stringify(example)}`;
}

/** Parse a flat translation-only response: { fr: "...", ar: "..." } */
export function parseTranslationOnlyResponse(
  text: string,
): Record<string, string> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in AI response:\n${text}`);
  const parsed = JSON.parse(match[0]) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Invalid translation response: ${match[0]}`);
  }
  return parsed as Record<string, string>;
}

// ─── Response parser ─────────────────────────────────────────────────────────

export interface ParsedAIResponse {
  key: string;
  translations: Record<string, string>;
}

/**
 * Extract and validate the JSON object from an AI response string.
 * Tolerates leading/trailing explanation text around the JSON.
 */
export function parseAIResponse(text: string): ParsedAIResponse {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in AI response:\n${text}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Failed to parse AI response JSON: ${String(err)}\n${match[0]}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)["key"] !== "string" ||
    typeof (parsed as Record<string, unknown>)["translations"] !== "object" ||
    (parsed as Record<string, unknown>)["translations"] === null
  ) {
    throw new Error(
      `AI response missing required fields (key, translations):\n${match[0]}`,
    );
  }

  return parsed as ParsedAIResponse;
}
