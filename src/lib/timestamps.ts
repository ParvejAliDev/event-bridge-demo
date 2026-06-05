export type TimestampInput = Date | string;

const missingTimezoneMinutesPattern = /([+-]\d{2})$/;

function normalizeTimestampInput(value: TimestampInput): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (missingTimezoneMinutesPattern.test(value)) {
    return value.replace(missingTimezoneMinutesPattern, '$1:00');
  }

  return value;
}

export function serializeTimestamp(value: TimestampInput): string {
  const timestamp = new Date(normalizeTimestampInput(value));

  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error(`Invalid timestamp value: ${value}`);
  }

  return timestamp.toISOString();
}

export function serializeNullableTimestamp(
  value: TimestampInput | null,
): string | null {
  if (value === null) {
    return null;
  }

  return serializeTimestamp(value);
}
