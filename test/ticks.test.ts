import { describe, expect, test } from "bun:test";
import { timeTicks } from "../src/layout/ticks.ts";

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1);

describe("timeTicks", () => {
  test("uses days when zoomed in", () => {
    const ticks = timeTicks(t0, t0 + 7 * DAY, 100 / DAY, 80);
    expect(ticks.unit).toBe("day");
    expect(ticks.items[0]?.t).toBe(t0);
    expect(ticks.items).toHaveLength(8);
  });

  test("uses months when zoomed out", () => {
    const ticks = timeTicks(t0, t0 + 365 * DAY, 4 / DAY, 80);
    expect(ticks.unit).toBe("month");
    expect(ticks.items.every((i) => new Date(i.t).getUTCDate() === 1)).toBe(true);
  });

  test("uses years when extremely zoomed out", () => {
    expect(timeTicks(t0, t0 + 3650 * DAY, 0.05 / DAY, 80).unit).toBe("year");
  });

  test("spacing never falls below the minimum", () => {
    for (const pxPerDay of [0.02, 0.3, 1, 3, 9, 40, 300, 3000]) {
      const ticks = timeTicks(t0, t0 + 400 * DAY, pxPerDay / DAY, 80);
      const [a, b] = ticks.items;
      if (a && b) expect((b.t - a.t) * (pxPerDay / DAY)).toBeGreaterThanOrEqual(80 * 0.9);
    }
  });

  test("marks year boundaries as major", () => {
    const ticks = timeTicks(Date.UTC(2025, 10, 1), Date.UTC(2026, 2, 1), 4 / DAY, 80);
    expect(ticks.items.find((i) => i.t === t0)?.major).toBe(true);
    expect(ticks.items.find((i) => i.t === Date.UTC(2026, 1, 1))?.major).toBe(false);
  });
});
