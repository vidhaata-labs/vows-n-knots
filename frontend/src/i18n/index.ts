// All user-visible copy comes from en.json. Components use useTranslation(); plain modules use t().
// Option values that go to the API (priorities, styles, dietary tags, venue settings) are never translated:
// only their labels are.
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/i18n/en.json"

export const resources = { en: { translation: en } } as const

void i18next.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes output already
  returnNull: false,
})

// Typed keys: a misspelled key is a type error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: (typeof resources)["en"]
  }
}

export const t = i18next.t.bind(i18next)
export default i18next
