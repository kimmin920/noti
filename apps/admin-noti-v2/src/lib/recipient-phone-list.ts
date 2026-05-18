export const MANUAL_MESSAGE_RECIPIENT_LIMIT = 100;

export function parseRecipientPhonesInput(value: string) {
  const seen = new Set<string>();
  const phones: string[] = [];

  for (const rawPhone of value.split(/[\n,;]+/)) {
    const phone = rawPhone.trim();
    const key = getRecipientPhoneKey(phone);
    if (!phone || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    phones.push(phone);
  }

  return phones;
}

export function formatRecipientPhonesInput(phones: string[]) {
  return phones.map((phone) => formatRecipientPhone(phone)).join("\n");
}

export function getRecipientPhoneKey(value: string) {
  return value.replace(/\D/g, "");
}

export function formatRecipientCountText(count: number) {
  return `${new Intl.NumberFormat("ko-KR").format(count)}명`;
}

export function formatRecipientPhone(value: string) {
  const digits = getRecipientPhoneKey(value);

  if (digits.length === 8) {
    return digits.replace(/(\d{4})(\d{4})/, "$1-$2");
  }

  if (digits.length === 9) {
    return digits.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
    }

    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }

  return value.trim();
}
