import { planProgress } from '../planProgress';

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('planProgress — elapsed days, since the app logs nothing', () => {
  it('starts on Day 1 of Week 1 with nothing elapsed', () => {
    expect(planProgress('2026-09-14T03:21:00.000Z', 12, day('2026-09-14'))).toEqual({
      weekIndex: 0,
      completedDays: 0,
      finished: false,
    });
  });

  it('fills one slot per calendar day inside the week', () => {
    expect(planProgress(day('2026-09-14'), 12, day('2026-09-17'))).toMatchObject({
      weekIndex: 0,
      completedDays: 3,
    });
  });

  it('rolls into the next week after seven days', () => {
    expect(planProgress(day('2026-09-14'), 12, day('2026-09-21'))).toMatchObject({
      weekIndex: 1,
      completedDays: 0,
    });
    expect(planProgress(day('2026-09-14'), 12, day('2026-09-30'))).toMatchObject({
      weekIndex: 2,
      completedDays: 2,
    });
  });

  it('never runs past the last week', () => {
    expect(planProgress(day('2026-01-01'), 4, day('2026-09-14'))).toEqual({
      weekIndex: 3,
      completedDays: 7,
      finished: true,
    });
  });

  it('never goes negative for a plan created "in the future" (clock skew)', () => {
    expect(planProgress(day('2026-09-20'), 12, day('2026-09-14'))).toMatchObject({
      weekIndex: 0,
      completedDays: 0,
    });
  });

  it('falls back to the start for an unparseable date or an empty plan', () => {
    expect(planProgress('not a date', 12, day('2026-09-14'))).toEqual({
      weekIndex: 0,
      completedDays: 0,
      finished: false,
    });
    expect(planProgress(day('2026-09-14'), 0, day('2026-09-14'))).toMatchObject({ weekIndex: 0 });
  });
});
