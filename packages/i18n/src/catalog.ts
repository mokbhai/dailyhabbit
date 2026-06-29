export type MessageValue = string | MessageCatalog;

export interface MessageCatalog {
  readonly [key: string]: MessageValue;
}

export type CatalogValidationIssueType =
  | 'missing'
  | 'extra'
  | 'type-mismatch'
  | 'empty';

export interface CatalogValidationIssue {
  path: string;
  type: CatalogValidationIssueType;
}

export interface ValidateCatalogShapeOptions {
  allowExtraKeys?: boolean;
  requireNonEmptyStrings?: boolean;
}

function isCatalog(value: MessageValue | undefined): value is MessageCatalog {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getValueKind(value: MessageValue | undefined) {
  if (value === undefined) return 'missing';
  return typeof value === 'string' ? 'string' : 'object';
}

function joinPath(basePath: string, key: string) {
  return basePath ? `${basePath}.${key}` : key;
}

function compareCatalogs({
  reference,
  candidate,
  basePath,
  issues,
  options,
}: {
  reference: MessageCatalog;
  candidate: MessageCatalog | undefined;
  basePath: string;
  issues: CatalogValidationIssue[];
  options: Required<ValidateCatalogShapeOptions>;
}) {
  const referenceKeys = Object.keys(reference).sort();

  for (const key of referenceKeys) {
    const path = joinPath(basePath, key);
    const referenceValue = reference[key];
    const candidateValue = candidate?.[key];

    if (candidateValue === undefined) {
      issues.push({ path, type: 'missing' });
      continue;
    }

    if (getValueKind(referenceValue) !== getValueKind(candidateValue)) {
      issues.push({ path, type: 'type-mismatch' });
      continue;
    }

    if (
      typeof referenceValue === 'string' &&
      typeof candidateValue === 'string'
    ) {
      if (options.requireNonEmptyStrings && candidateValue.trim() === '') {
        issues.push({ path, type: 'empty' });
      }

      continue;
    }

    if (isCatalog(referenceValue) && isCatalog(candidateValue)) {
      compareCatalogs({
        reference: referenceValue,
        candidate: candidateValue,
        basePath: path,
        issues,
        options,
      });
    }
  }

  if (options.allowExtraKeys || candidate === undefined) return;

  for (const key of Object.keys(candidate).sort()) {
    if (!(key in reference)) {
      issues.push({ path: joinPath(basePath, key), type: 'extra' });
    }
  }
}

export function listCatalogKeys(catalog: MessageCatalog): string[] {
  const keys: string[] = [];

  for (const key of Object.keys(catalog).sort()) {
    const value = catalog[key];

    if (typeof value === 'string') {
      keys.push(key);
      continue;
    }

    keys.push(
      ...listCatalogKeys(value).map((childKey) => `${key}.${childKey}`),
    );
  }

  return keys;
}

export function getCatalogString(catalog: MessageCatalog, key: string) {
  const value = key
    .split('.')
    .reduce<MessageValue | undefined>((currentValue, part) => {
      if (!isCatalog(currentValue)) return undefined;
      return currentValue[part];
    }, catalog);

  return typeof value === 'string' ? value : undefined;
}

export function validateCatalogShape(
  reference: MessageCatalog,
  candidate: MessageCatalog,
  options: ValidateCatalogShapeOptions = {},
) {
  const issues: CatalogValidationIssue[] = [];

  compareCatalogs({
    reference,
    candidate,
    basePath: '',
    issues,
    options: {
      allowExtraKeys: options.allowExtraKeys ?? false,
      requireNonEmptyStrings: options.requireNonEmptyStrings ?? true,
    },
  });

  return issues.sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    return left.type.localeCompare(right.type);
  });
}
