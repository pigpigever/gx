import type { GxConfig } from "../types.js";

// ── Locale type ──

export type LocaleValue = string | { [key: string]: LocaleValue };
export type LocaleStrings = { [key: string]: LocaleValue };

// ── Registry ──

const locales: Record<string, () => Promise<{ default: LocaleStrings }>> = {};

export function registerLocale(lang: string, loader: () => Promise<{ default: LocaleStrings }>): void {
  locales[lang] = loader;
}

// ── Runtime state ──

let currentLang: string | null = null;
let currentStrings: LocaleStrings | null = null;

export function getLang(): string {
  return currentLang ?? "en";
}

/** Initialize i18n from config. Call once at startup. */
export function initI18n(config: GxConfig): void {
  currentLang = config.language || "en";
}

/** Load locale data for the current language (or a specific one). */
export async function loadLocale(lang?: string): Promise<void> {
  const target = lang ?? currentLang ?? "en";
  const loader = locales[target];
  if (!loader) {
    // Fall back to en if requested locale not registered
    const enLoader = locales["en"];
    if (enLoader) {
      const mod = await enLoader();
      currentStrings = mod.default;
      currentLang = "en";
    }
    return;
  }
  const mod = await loader();
  currentStrings = mod.default;
  currentLang = target;
}

/** Reload locale after language change. Sets currentLang and loads strings. */
export async function switchLanguage(lang: string): Promise<void> {
  currentLang = lang;
  await loadLocale(lang);
}

// ── Translation ──

/**
 * Translate a dotted key path. Supports {{variable}} interpolation.
 * Falls back to key if translation not found.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = resolveKey(key, currentStrings);
  if (raw === undefined) return key;

  if (!vars) return raw;

  return raw.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = vars[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

function resolveKey(
  key: string,
  strings: LocaleStrings | null
): string | undefined {
  if (!strings) return undefined;

  const parts = key.split(".");
  let current: LocaleValue | undefined = strings;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, LocaleValue>)[part];
  }

  return typeof current === "string" ? current : undefined;
}
