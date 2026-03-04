const { DateTime } = require("luxon");

function nowUtc() {
  return DateTime.utc();
}

function toDateTimeUtc(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: "utc" });
  }
  if (DateTime.isDateTime(value)) {
    return value.toUTC();
  }
  return DateTime.fromISO(String(value), { setZone: true }).toUTC();
}

function parseIsoToDate(value) {
  const dt = DateTime.fromISO(String(value), { setZone: true });
  if (!dt.isValid) {
    return null;
  }
  return dt.toUTC().toJSDate();
}

function isNowWithinWindow(now, start, end) {
  const nowDt = toDateTimeUtc(now);
  const startDt = toDateTimeUtc(start);
  const endDt = toDateTimeUtc(end);
  if (!nowDt || !startDt) {
    return false;
  }
  if (endDt) {
    return nowDt >= startDt && nowDt <= endDt;
  }
  return nowDt >= startDt;
}

function parseHhMm(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function isInQuietHours(now, timezone, quietStart, quietEnd) {
  const start = parseHhMm(quietStart);
  const end = parseHhMm(quietEnd);
  if (!start || !end) {
    return false;
  }

  const local = toDateTimeUtc(now).setZone(timezone);
  const minutes = local.hour * 60 + local.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (startMinutes === endMinutes) {
    return false;
  }
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

function addMinutes(dateLike, minutes) {
  return toDateTimeUtc(dateLike).plus({ minutes }).toJSDate();
}

function addHours(dateLike, hours) {
  return toDateTimeUtc(dateLike).plus({ hours }).toJSDate();
}

function alignToNudgeableStart(dateLike, timezone, quietStart, quietEnd) {
  const start = parseHhMm(quietStart);
  const end = parseHhMm(quietEnd);
  const dt = toDateTimeUtc(dateLike).setZone(timezone);

  if (!start || !end || !isInQuietHours(dt, timezone, quietStart, quietEnd)) {
    return dt.toUTC().toJSDate();
  }

  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const nowMinutes = dt.hour * 60 + dt.minute;

  let localNext = dt.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
  const crossesMidnight = startMinutes > endMinutes;

  if (crossesMidnight && nowMinutes >= startMinutes) {
    localNext = localNext.plus({ days: 1 });
  }
  if (!crossesMidnight && localNext <= dt) {
    localNext = localNext.plus({ days: 1 });
  }

  return localNext.toUTC().toJSDate();
}

function formatWindowForUser(dateLike, timezone) {
  if (!dateLike) {
    return "open";
  }
  return toDateTimeUtc(dateLike)
    .setZone(timezone)
    .toFormat("yyyy-LL-dd HH:mm");
}

module.exports = {
  nowUtc,
  toDateTimeUtc,
  parseIsoToDate,
  isNowWithinWindow,
  isInQuietHours,
  addMinutes,
  addHours,
  alignToNudgeableStart,
  formatWindowForUser
};
