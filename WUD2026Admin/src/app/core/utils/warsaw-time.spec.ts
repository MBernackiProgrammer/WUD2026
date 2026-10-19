import { warsawDateTime, warsawToIso } from './warsaw-time';

describe('Warsaw publication time', () => {
  it('converts summer time independently of the browser timezone', () => {
    expect(warsawToIso('2026-10-17T20:30')).toBe('2026-10-17T18:30:00.000Z');
  });
  it('converts winter time independently of the browser timezone', () => {
    expect(warsawToIso('2026-12-17T20:30')).toBe('2026-12-17T19:30:00.000Z');
  });
  it('rejects nonexistent local times at the spring DST transition', () => {
    expect(warsawToIso('2026-03-29T02:30')).toBeNull();
  });
  it('formats stored UTC dates in Warsaw time', () => {
    expect(warsawDateTime('2026-10-17T18:30:00Z')).toBe('2026-10-17T20:30');
  });
});
