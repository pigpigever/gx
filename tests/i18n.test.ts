import { describe, it, expect, beforeEach } from "vitest";
import { registerLocale, initI18n, loadLocale, t, getLang, switchLanguage } from "../src/lib/i18n.js";
import type { LocaleStrings } from "../src/lib/i18n.js";

const enStrings: LocaleStrings = {
  hello: "Hello {{name}}",
  nested: { deep: "deep value" },
  general: { ok: "OK" },
};

const zhStrings: LocaleStrings = {
  hello: "你好 {{name}}",
  nested: { deep: "深层值" },
  general: { ok: "好的" },
};

registerLocale("en", () => Promise.resolve({ default: enStrings }));
registerLocale("zh", () => Promise.resolve({ default: zhStrings }));

beforeEach(async () => {
  initI18n({ version: 1, repos: {} });
  await loadLocale("en");
});

describe("i18n", () => {
  it("translates simple keys", () => {
    expect(t("general.ok")).toBe("OK");
  });

  it("translates nested keys", () => {
    expect(t("nested.deep")).toBe("deep value");
  });

  it("interpolates variables", () => {
    expect(t("hello", { name: "World" })).toBe("Hello World");
  });

  it("falls back to key for missing translation", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("returns key when vars missing placeholder", () => {
    expect(t("hello")).toBe("Hello {{name}}");
  });

  it("ignores extra vars", () => {
    expect(t("hello", { name: "X", extra: "ignored" })).toBe("Hello X");
  });

  it("getLang returns current language", () => {
    expect(getLang()).toBe("en");
  });

  it("switchLanguage changes locale", async () => {
    await switchLanguage("zh");
    expect(getLang()).toBe("zh");
    expect(t("hello", { name: "世界" })).toBe("你好 世界");
    expect(t("nested.deep")).toBe("深层值");
  });

  it("falls back to en for unknown language", async () => {
    await switchLanguage("fr");
    expect(getLang()).toBe("en"); // fell back
    expect(t("general.ok")).toBe("OK");
  });
});
