export const DEFAULT_SMS_TEMPLATE_VARIABLES = ['이름', '가격', '시간', '상품명', '수량'] as const;

const HASH_TEMPLATE_VARIABLE_REGEX = /#\{\s*([^}]+?)\s*\}/g;

export type TemplateBodyToken =
  | { type: 'text'; value: string }
  | { type: 'variable'; value: string };

export function normalizeTemplateVariableName(raw: string): string {
  return raw
    .replace(/^#\{\s*/, '')
    .replace(/\s*\}$/, '')
    .trim();
}

export function formatTemplateVariable(name: string): string {
  return `#{${normalizeTemplateVariableName(name)}}`;
}

export function extractHashTemplateVariables(body: string): string[] {
  const matches = [...body.matchAll(HASH_TEMPLATE_VARIABLE_REGEX)]
    .map((match) => normalizeTemplateVariableName(match[1] ?? ''))
    .filter(Boolean);

  return [...new Set(matches)];
}

export function tokenizeTemplateBody(body: string): TemplateBodyToken[] {
  const tokens: TemplateBodyToken[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(HASH_TEMPLATE_VARIABLE_REGEX)) {
    const index = match.index ?? 0;
    const variableName = normalizeTemplateVariableName(match[1] ?? '');

    if (index > lastIndex) {
      tokens.push({ type: 'text', value: body.slice(lastIndex, index) });
    }

    if (variableName) {
      tokens.push({ type: 'variable', value: variableName });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    tokens.push({ type: 'text', value: body.slice(lastIndex) });
  }

  if (tokens.length === 0) {
    tokens.push({ type: 'text', value: '' });
  }

  return tokens;
}

export function mergeTemplateVariables(...groups: Array<readonly string[] | string[]>): string[] {
  const merged = groups.flatMap((group) => group.map((entry) => normalizeTemplateVariableName(entry)).filter(Boolean));
  return [...new Set(merged)];
}

export function renderTemplatePreview(
  body: string,
  variables: Record<string, string | number | null | undefined>
): string {
  return body.replace(HASH_TEMPLATE_VARIABLE_REGEX, (token, rawName) => {
    const variableName = normalizeTemplateVariableName(rawName ?? '');
    const value = variables[variableName];

    if (value === undefined || value === null || value === '') {
      return token;
    }

    return String(value);
  });
}

export function missingTemplateVariables(
  requiredVariables: readonly string[],
  variables: Record<string, string | number | null | undefined>
): string[] {
  return requiredVariables.filter((variableName) => {
    const value = variables[normalizeTemplateVariableName(variableName)];
    return value === undefined || value === null || value === '';
  });
}
