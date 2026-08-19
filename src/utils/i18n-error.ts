import i18n from "@/locales";

/**
 * Translates a backend error code string to a user-facing message.
 * Backend errors follow the pattern "ERR_CODE:detail" or are plain English.
 */
export function translateError(error: string): string {
  const idx = error.indexOf(":");
  const code = idx > 0 ? error.slice(0, idx) : error;
  const detail = idx > 0 ? error.slice(idx + 1) : "";

  const key = `errors.${code}`;
  if (i18n.exists(key, { ns: "common" })) {
    return i18n.t(key, { ns: "common", detail });
  }

  return error;
}
