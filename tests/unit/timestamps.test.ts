import { describe, expect, it } from 'vitest';

import {
  serializeNullableTimestamp,
  serializeTimestamp,
} from '../../src/lib/timestamps';

describe('serializeTimestamp', () => {
  it('returns an ISO string for Date values', () => {
    expect(serializeTimestamp(new Date('2026-06-05T08:12:17.976Z'))).toBe(
      '2026-06-05T08:12:17.976Z',
    );
  });

  it('normalizes database timestamps that omit timezone minutes', () => {
    expect(serializeTimestamp('2026-06-05T08:12:17+00')).toBe(
      '2026-06-05T08:12:17.000Z',
    );
  });
});

describe('serializeNullableTimestamp', () => {
  it('preserves null values', () => {
    expect(serializeNullableTimestamp(null)).toBeNull();
  });
});
