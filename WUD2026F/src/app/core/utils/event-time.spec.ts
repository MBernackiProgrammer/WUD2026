import { isPastEvent } from './event-time';

describe('Event archive time in Szczecin', () => {
  it('uses the start time, including earlier events on the same day', () => {
    const event = { date: '2026-10-24', time: '20:00' };
    expect(isPastEvent(event, new Date('2026-10-24T17:59:59Z'))).toBeFalse();
    expect(isPastEvent(event, new Date('2026-10-24T18:00:00Z'))).toBeTrue();
  });

  it('uses the Warsaw date across midnight and year boundaries', () => {
    expect(
      isPastEvent({ date: '2027-01-01', time: '00:15' }, new Date('2026-12-31T23:30:00Z')),
    ).toBeTrue();
    expect(
      isPastEvent({ date: '2027-01-01', time: '00:45' }, new Date('2026-12-31T23:30:00Z')),
    ).toBeFalse();
  });

  it('respects both winter and summer offsets without relying on the browser timezone', () => {
    expect(
      isPastEvent({ date: '2026-01-10', time: '19:00' }, new Date('2026-01-10T18:00:00Z')),
    ).toBeTrue();
    expect(
      isPastEvent({ date: '2026-07-10', time: '19:00' }, new Date('2026-07-10T17:00:00Z')),
    ).toBeTrue();
    expect(
      isPastEvent({ date: '2026-07-10', time: '19:00' }, new Date('2026-07-10T16:59:59Z')),
    ).toBeFalse();
  });
});
