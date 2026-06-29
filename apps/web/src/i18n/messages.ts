import { createTranslator, type MessageCatalog } from '@workspace-starter/i18n';

import deHome from '../locales/de/home.json';
import enHome from '../locales/en/home.json';
import { fallbackLocale, type Locale } from './config';

export type MessageNamespace = 'home';

const catalogs = {
  en: {
    home: enHome,
  },
  de: {
    home: deHome,
  },
} satisfies Record<Locale, Record<MessageNamespace, MessageCatalog>>;

export function getTranslations(locale: Locale, namespace: MessageNamespace) {
  const fallbackCatalog = catalogs[fallbackLocale][namespace];
  const catalog = catalogs[locale]?.[namespace] ?? fallbackCatalog;

  return createTranslator(catalog, fallbackCatalog);
}
