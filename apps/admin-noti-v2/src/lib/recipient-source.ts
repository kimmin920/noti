export const ALL_RECIPIENT_SOURCE_FILTER = "ALL";

export function getRecipientSourceKey(source: string | null | undefined) {
  const value = source?.trim() ?? "";
  const normalizedValue = value.toLowerCase();

  if (!value) {
    return "";
  }

  if (normalizedValue === "manual") {
    return "manual";
  }

  if (normalizedValue === "notion" || normalizedValue.startsWith("notion:")) {
    return "notion";
  }

  return value;
}

export function formatRecipientSource(source: string | null | undefined) {
  const sourceKey = getRecipientSourceKey(source);

  if (!sourceKey) {
    return "—";
  }

  if (sourceKey === "manual") {
    return "직접입력";
  }

  if (sourceKey === "notion") {
    return "notion";
  }

  return sourceKey;
}

export function recipientSourceMatchesFilter(source: string | null | undefined, filter: string) {
  if (!filter || filter === ALL_RECIPIENT_SOURCE_FILTER) {
    return true;
  }

  return getRecipientSourceKey(source) === filter;
}

export function getRecipientSourceFilterOptions(sources: Array<string | null | undefined>) {
  const options = new Map<string, string>();

  sources.forEach((source) => {
    const key = getRecipientSourceKey(source);

    if (key) {
      options.set(key, formatRecipientSource(source));
    }
  });

  return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) =>
    left.label.localeCompare(right.label, "ko-KR"),
  );
}
