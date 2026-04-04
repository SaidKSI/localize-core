import { describe, it, expect } from "vitest";
import { resolveNamespaces, getNamespaceForFile } from "../../src/namespace.js";
import { ensureHook } from "../../src/rewriter/ts-morph.js";
import { LIBRARY_ADAPTERS } from "../../src/rewriter/transforms.js";

// ─── resolveNamespaces ────────────────────────────────────────────────────────

describe("resolveNamespaces", () => {
  it("returns lowercased basename for a single file", () => {
    const map = resolveNamespaces(["/src/Header.tsx"]);
    expect(map.get("/src/Header.tsx")).toBe("header");
  });

  it("returns lowercased basename for multiple files with distinct names", () => {
    const files = ["/src/Header.tsx", "/src/Footer.tsx", "/pages/Login.tsx"];
    const map = resolveNamespaces(files);
    expect(map.get("/src/Header.tsx")).toBe("header");
    expect(map.get("/src/Footer.tsx")).toBe("footer");
    expect(map.get("/pages/Login.tsx")).toBe("login");
  });

  it("assigns base name to first occurrence on collision", () => {
    const files = ["/src/Header.tsx", "/admin/Header.tsx"];
    const map = resolveNamespaces(files);
    expect(map.get("/src/Header.tsx")).toBe("header");
    expect(map.get("/admin/Header.tsx")).toBe("header_1");
  });

  it("assigns sequential suffixes for 3+ collisions", () => {
    const files = ["/a/Header.tsx", "/b/Header.tsx", "/c/Header.tsx"];
    const map = resolveNamespaces(files);
    expect(map.get("/a/Header.tsx")).toBe("header");
    expect(map.get("/b/Header.tsx")).toBe("header_1");
    expect(map.get("/c/Header.tsx")).toBe("header_2");
  });

  it("handles mixed collisions and unique names", () => {
    const files = [
      "/src/Header.tsx",
      "/src/Login.tsx",
      "/admin/Header.tsx",
    ];
    const map = resolveNamespaces(files);
    expect(map.get("/src/Header.tsx")).toBe("header");
    expect(map.get("/src/Login.tsx")).toBe("login");
    expect(map.get("/admin/Header.tsx")).toBe("header_1");
  });

  it("returns empty map for empty input", () => {
    const map = resolveNamespaces([]);
    expect(map.size).toBe(0);
  });

  it("handles .js and .jsx extensions", () => {
    const files = ["/src/App.js", "/src/App.jsx"];
    const map = resolveNamespaces(files);
    expect(map.get("/src/App.js")).toBe("app");
    expect(map.get("/src/App.jsx")).toBe("app_1");
  });
});

describe("getNamespaceForFile", () => {
  it("returns correct namespace for file in batch", () => {
    const ns = getNamespaceForFile("/src/Header.tsx", [
      "/src/Header.tsx",
      "/admin/Header.tsx",
    ]);
    expect(ns).toBe("header");
  });

  it("returns suffixed namespace for second occurrence", () => {
    const ns = getNamespaceForFile("/admin/Header.tsx", [
      "/src/Header.tsx",
      "/admin/Header.tsx",
    ]);
    expect(ns).toBe("header_1");
  });

  it("falls back to lowercased basename if file not in list", () => {
    const ns = getNamespaceForFile("/unknown/Header.tsx", ["/other/Login.tsx"]);
    expect(ns).toBe("header");
  });
});

// ─── ensureHook — namespace injection ────────────────────────────────────────

const adapter = LIBRARY_ADAPTERS["react-i18next"];

describe("ensureHook — namespace handling", () => {
  const baseComponent = `
import React from 'react';
import { useTranslation } from 'react-i18next';

function Header() {
  const { t } = useTranslation();
  return <h1>{t('header.title')}</h1>;
}

export default Header;
`.trimStart();

  it("updates useTranslation() to useTranslation('header') when no namespace present", () => {
    const result = ensureHook(baseComponent, "Header.tsx", adapter, "header");
    expect(result).toContain("useTranslation('header')");
    expect(result).not.toMatch(/useTranslation\(\s*\)/);
  });

  it("leaves useTranslation('login') untouched when namespace is already set", () => {
    const source = baseComponent.replace("useTranslation()", "useTranslation('login')");
    const result = ensureHook(source, "Header.tsx", adapter, "header");
    expect(result).toContain("useTranslation('login')");
    expect(result).not.toContain("useTranslation('header')");
  });

  it("leaves useTranslation('header') untouched (already correct)", () => {
    const source = baseComponent.replace("useTranslation()", "useTranslation('header')");
    const result = ensureHook(source, "Header.tsx", adapter, "header");
    // unchanged — should still be useTranslation('header') exactly once
    const matches = (result.match(/useTranslation\('header'\)/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("preserves { i18n, t } destructuring when updating namespace", () => {
    const source = baseComponent.replace(
      "const { t } = useTranslation()",
      "const { i18n, t } = useTranslation()",
    );
    const result = ensureHook(source, "Header.tsx", adapter, "header");
    expect(result).toContain("{ i18n, t } = useTranslation('header')");
  });

  it("injects hook with namespace when hook is completely absent", () => {
    const source = `
import React from 'react';
function Login() {
  return <div>Hello</div>;
}
export default Login;
`.trimStart();
    const result = ensureHook(source, "Login.tsx", adapter, "login");
    expect(result).toContain("useTranslation('login')");
  });

  it("does not add namespace to useIntl (react-intl)", () => {
    const intlAdapter = LIBRARY_ADAPTERS["react-intl"];
    const source = `
import React from 'react';
function Page() {
  const intl = useIntl();
  return <div>{intl.formatMessage({ id: 'key' })}</div>;
}
export default Page;
`.trimStart();
    const result = ensureHook(source, "Page.tsx", intlAdapter, "page");
    // useIntl does not accept namespace — should remain useIntl()
    expect(result).toContain("useIntl()");
    expect(result).not.toContain("useIntl('page')");
  });
});
