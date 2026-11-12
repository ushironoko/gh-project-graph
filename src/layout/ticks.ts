export type TickUnit = "hour" | "day" | "week" | "month" | "year";

export type Tick = { t: number; label: string; major: boolean };

export type Ticks = { unit: TickUnit; items: Tick[] };

type Step = { unit: TickUnit; n: number; approx: number };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const steps: ReadonlyArray<Step> = [
  { unit: "hour", n: 1, approx: HOUR },
  { unit: "hour", n: 3, approx: 3 * HOUR },
  { unit: "hour", n: 6, approx: 6 * HOUR },
  { unit: "hour", n: 12, approx: 12 * HOUR },
  { unit: "day", n: 1, approx: DAY },
  { unit: "week", n: 1, approx: 7 * DAY },
  { unit: "month", n: 1, approx: 30.44 * DAY },
  { unit: "month", n: 3, approx: 91.3 * DAY },
  { unit: "year", n: 1, approx: 365.25 * DAY },
  { unit: "year", n: 5, approx: 5 * 365.25 * DAY },
  { unit: "year", n: 10, approx: 10 * 365.25 * DAY },
  { unit: "year", n: 50, approx: 50 * 365.25 * DAY },
];

const floorTo = (t: number, step: Step): Date => {
  const d = new Date(t);
  d.setMinutes(0, 0, 0);
  if (step.unit === "hour") {
    d.setHours(d.getHours() - (d.getHours() % step.n));
    return d;
  }
  d.setHours(0);
  if (step.unit === "day") return d;
  if (step.unit === "week") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  d.setDate(1);
  if (step.unit === "month") {
    d.setMonth(d.getMonth() - (d.getMonth() % step.n));
    return d;
  }
  d.setMonth(0);
  d.setFullYear(d.getFullYear() - (d.getFullYear() % step.n));
  return d;
};

const advance = (d: Date, step: Step): Date => {
  const next = new Date(d);
  if (step.unit === "hour") next.setHours(next.getHours() + step.n);
  if (step.unit === "day") next.setDate(next.getDate() + step.n);
  if (step.unit === "week") next.setDate(next.getDate() + 7 * step.n);
  if (step.unit === "month") next.setMonth(next.getMonth() + step.n);
  if (step.unit === "year") next.setFullYear(next.getFullYear() + step.n);
  return next;
};

const isMajor = (d: Date, unit: TickUnit): boolean => {
  if (unit === "hour") return d.getHours() === 0;
  if (unit === "day" || unit === "week") return d.getDate() === 1;
  if (unit === "month") return d.getMonth() === 0;
  return d.getFullYear() % 10 === 0;
};

const pad = (n: number) => String(n).padStart(2, "0");

const labelOf = (d: Date, unit: TickUnit, major: boolean): string => {
  if (unit === "hour")
    return major ? `${d.getMonth() + 1}/${d.getDate()}` : `${pad(d.getHours())}:00`;
  if (unit === "day" || unit === "week")
    return major && d.getMonth() === 0
      ? `${d.getFullYear()}/1/1`
      : `${d.getMonth() + 1}/${d.getDate()}`;
  if (unit === "month") return major ? `${d.getFullYear()}` : `${d.getMonth() + 1}月`;
  return `${d.getFullYear()}`;
};

const MAX_TICKS = 2000;

export const timeTicks = (t0: number, t1: number, pxPerMs: number, minSpacing: number): Ticks => {
  const step =
    steps.find((s) => s.approx * pxPerMs >= minSpacing) ?? (steps[steps.length - 1] as Step);
  const items: Tick[] = [];
  for (
    let d = floorTo(t0, step);
    d.getTime() <= t1 && items.length < MAX_TICKS;
    d = advance(d, step)
  ) {
    const major = isMajor(d, step.unit);
    items.push({ t: d.getTime(), label: labelOf(d, step.unit, major), major });
  }
  return { unit: step.unit, items };
};
