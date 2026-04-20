type NightSendWindow = {
  start: string;
  end: string;
};

function parseMinuteOfDay(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function isRestrictedMinute(minuteOfDay: number, window: NightSendWindow) {
  const start = parseMinuteOfDay(window.start);
  const end = parseMinuteOfDay(window.end);

  if (start === null || end === null) {
    return false;
  }

  if (start < end) {
    return minuteOfDay >= start && minuteOfDay < end;
  }

  return minuteOfDay >= start || minuteOfDay < end;
}

function getKstMinuteOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "", 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

export function isBrandMessageImmediateRestricted(window: NightSendWindow) {
  const currentMinute = getKstMinuteOfDay(new Date());
  if (currentMinute === null) {
    return false;
  }

  return isRestrictedMinute(currentMinute, window);
}

export function isBrandMessageScheduleRestricted(
  scheduledAt: string,
  window: NightSendWindow,
) {
  if (!scheduledAt) {
    return false;
  }

  const timeText = scheduledAt.slice(11, 16);
  const minuteOfDay = parseMinuteOfDay(timeText);
  if (minuteOfDay === null) {
    return false;
  }

  return isRestrictedMinute(minuteOfDay, window);
}

export function getBrandMessageNightWindowText(window: NightSendWindow) {
  return `브랜드 메시지는 KST 기준 ${window.start} ~ 익일 ${window.end} 사이에는 발송할 수 없습니다.`;
}
