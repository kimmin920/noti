"use client";

export function normalizeTemplateParameters(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, entryValue == null ? "" : String(entryValue)])
      .filter(([key]) => Boolean(key)),
  );
}

export function renderTemplateTextWithVariables(text: string | null | undefined, variables: Record<string, string>) {
  const raw = text || "";
  return raw.replace(/#\{([^}]+)\}/g, (_, token: string) => variables[token]?.trim() || `#{${token}}`);
}

export function applyVariablesToBrandTemplate<T>(template: T, variables: Record<string, string>): T {
  return replaceTemplateVariables(template, variables) as T;
}

function replaceTemplateVariables(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === "string") {
    return renderTemplateTextWithVariables(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTemplateVariables(item, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        replaceTemplateVariables(nestedValue, variables),
      ]),
    );
  }

  return value;
}
