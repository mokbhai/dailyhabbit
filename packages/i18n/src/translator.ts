import { getCatalogString, type MessageCatalog } from './catalog.js';

export type InterpolationValue = string | number | boolean | null | undefined;

export type InterpolationValues = Record<string, InterpolationValue>;

export type Translator = (key: string, values?: InterpolationValues) => string;

function interpolate(message: string, values: InterpolationValues = {}) {
  return message.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (token, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? token : String(value);
  });
}

export function createTranslator(
  messages: MessageCatalog,
  fallbackMessages: MessageCatalog = messages,
): Translator {
  return (key, values) => {
    const message =
      getCatalogString(messages, key) ??
      getCatalogString(fallbackMessages, key);

    return message === undefined ? key : interpolate(message, values);
  };
}
