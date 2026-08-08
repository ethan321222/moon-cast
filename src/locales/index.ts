import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCommon from "./zh-CN/common.json";
import zhBrowser from "./zh-CN/browser.json";
import zhControl from "./zh-CN/control.json";
import zhComponents from "./zh-CN/components.json";

import enCommon from "./en/common.json";
import enBrowser from "./en/browser.json";
import enControl from "./en/control.json";
import enComponents from "./en/components.json";

const resources = {
  "zh-CN": {
    common: zhCommon,
    browser: zhBrowser,
    control: zhControl,
    components: zhComponents,
  },
  en: {
    common: enCommon,
    browser: enBrowser,
    control: enControl,
    components: enComponents,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh-CN",
    defaultNS: "common",
    ns: ["common", "browser", "control", "components"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      lookupLocalStorage: "mooncast-lang",
      convertDetectedLanguage: (lng: string) => {
        if (lng === "zh") return "zh-CN";
        if (lng === "system") {
          return navigator.language.startsWith("zh") ? "zh-CN" : "en";
        }
        return lng;
      },
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
