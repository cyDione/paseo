import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntlShim, polyfillIntl, type IntlDeviceInfo } from "./intl";

// Node ships a full Intl, so it is the reference the shim has to match for what the app uses.
const realIntl = Intl;
const deviceZone = realIntl.DateTimeFormat().resolvedOptions().timeZone;

function device(uses24hourClock: boolean | null): IntlDeviceInfo {
  return { timeZone: deviceZone, uses24hourClock };
}

// Recent ICU writes a narrow no-break space before AM/PM; the shim writes a plain space.
function plain(text: string): string {
  return text.replace(/[  ]/g, " ");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NumberFormat", () => {
  const shim = createIntlShim(device(null));
  const values = [
    0, 5, 5.55, 12.5, 999, 1000, 1234, 12345, 123456, 999999, 1234567, 2.5e9, 7e12, -1234,
  ];
  const cases: [string, Intl.NumberFormatOptions][] = [
    ["default", {}],
    ["fraction digits", { maximumFractionDigits: 2 }],
    ["min and max fraction digits", { minimumFractionDigits: 1, maximumFractionDigits: 3 }],
    ["no grouping", { useGrouping: false }],
    ["compact", { notation: "compact" }],
    ["compact with one fraction digit", { notation: "compact", maximumFractionDigits: 1 }],
    ["usd", { style: "currency", currency: "USD" }],
    ["eur", { style: "currency", currency: "EUR" }],
    ["jpy", { style: "currency", currency: "JPY" }],
  ];

  for (const [name, options] of cases) {
    it(`matches Intl for ${name}`, () => {
      const expected = new realIntl.NumberFormat("en-US", options);
      const actual = new shim.NumberFormat("en-US", options);
      for (const value of values) {
        expect(plain(actual.format(value)), `${value}`).toBe(plain(expected.format(value)));
      }
    });
  }

  it("formats non-finite values", () => {
    const actual = new shim.NumberFormat("en-US");
    expect(actual.format(Number.NaN)).toBe("NaN");
    expect(actual.format(Number.POSITIVE_INFINITY)).toBe("∞");
    expect(actual.format(Number.NEGATIVE_INFINITY)).toBe("-∞");
  });

  it("rejects options it does not implement", () => {
    expect(() => new shim.NumberFormat("en-US", { style: "percent" })).toThrow(RangeError);
    expect(() => new shim.NumberFormat("en-US", { notation: "scientific" })).toThrow(RangeError);
    expect(() => new shim.NumberFormat("en-US", { style: "currency" })).toThrow(TypeError);
  });
});

describe("DateTimeFormat", () => {
  const dates = [
    new Date(2026, 4, 14, 22, 11, 5),
    new Date(2026, 0, 3, 0, 5, 0),
    new Date(2026, 10, 9, 9, 30, 0),
    new Date(2026, 11, 31, 12, 0, 0),
    new Date(2026, 5, 7, 23, 59, 59),
  ];
  const cases: [string, Intl.DateTimeFormatOptions][] = [
    ["default date", {}],
    ["time 12-hour", { hour: "numeric", minute: "2-digit", hourCycle: "h12" }],
    ["time 24-hour", { hour: "numeric", minute: "2-digit", hourCycle: "h23" }],
    ["hour12 false", { hour: "numeric", minute: "2-digit", hour12: false }],
    ["hour only", { hour: "numeric", hourCycle: "h12" }],
    ["weekday", { weekday: "long" }],
    ["short month", { month: "short" }],
    ["short date", { day: "numeric", month: "short", year: "numeric" }],
    ["long date", { month: "long", day: "numeric", year: "numeric" }],
    ["long date in UTC", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }],
    ["weekday with date", { weekday: "short", month: "short", day: "numeric" }],
    ["month and year", { month: "long", year: "numeric" }],
    ["numeric date", { year: "numeric", month: "2-digit", day: "2-digit" }],
    [
      "date and time",
      { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hourCycle: "h12" },
    ],
  ];

  for (const [name, options] of cases) {
    it(`matches Intl for ${name}`, () => {
      const shim = createIntlShim(device(null));
      const expected = new realIntl.DateTimeFormat("en-US", options);
      const actual = new shim.DateTimeFormat("en-US", options);
      for (const date of dates) {
        expect(plain(actual.format(date)), date.toISOString()).toBe(plain(expected.format(date)));
      }
    });
  }

  it("formats a UTC date the same in any device zone", () => {
    const shim = createIntlShim({ timeZone: "Asia/Shanghai", uses24hourClock: true });
    const format = new shim.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
    expect(format.format(new Date(Date.UTC(2026, 4, 14)))).toBe("May 14, 2026");
  });

  it("follows the device clock preference when no hour cycle is given", () => {
    const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
    const evening = new Date(2026, 4, 14, 22, 11);
    const twelve = new (createIntlShim(device(false)).DateTimeFormat)(undefined, options);
    const twentyFour = new (createIntlShim(device(true)).DateTimeFormat)(undefined, options);
    expect(twelve.format(evening)).toBe("10:11 PM");
    expect(twentyFour.format(evening)).toBe("22:11");
    expect(twelve.resolvedOptions().hourCycle).toBe("h12");
    expect(twentyFour.resolvedOptions().hourCycle).toBe("h23");
  });

  it("can be called without new and reports the device time zone", () => {
    const shim = createIntlShim({ timeZone: "Asia/Shanghai", uses24hourClock: null });
    expect(shim.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Shanghai");
  });

  it("falls back to UTC when the device reports no time zone", () => {
    const shim = createIntlShim({ timeZone: null, uses24hourClock: null });
    expect(shim.DateTimeFormat().resolvedOptions().timeZone).toBe("UTC");
  });

  it("rejects a time zone it cannot convert to", () => {
    const shim = createIntlShim({ timeZone: "Asia/Shanghai", uses24hourClock: null });
    expect(() => new shim.DateTimeFormat(undefined, { timeZone: "America/New_York" })).toThrow(
      RangeError,
    );
  });
});

describe("polyfillIntl", () => {
  it("installs Intl when the runtime has none", () => {
    vi.stubGlobal("Intl", undefined);
    expect(typeof Intl).toBe("undefined");
    polyfillIntl(() => device(null));
    expect(new Intl.NumberFormat("en-US").format(1234.5)).toBe("1,234.5");
    expect(typeof (Intl as { Segmenter?: unknown }).Segmenter).toBe("undefined");
  });

  it("lets the modules that read Intl while loading start without a native Intl", async () => {
    vi.stubGlobal("Intl", undefined);
    polyfillIntl(() => device(null));
    vi.resetModules();
    const header = await import("../git/file-header-presentation");
    const reveal = await import("../agent-stream/text-reveal");
    const renderLimit = await import("../components/assistant-message-render-limit");
    expect(header.formatDiffCount(12_345)).toBe("12.3k");
    expect(reveal.isTextRevealPacingSupported()).toBe(false);
    expect(renderLimit.ASSISTANT_MESSAGE_RENDER_CHARACTER_LIMIT).toBeGreaterThan(0);
  });

  it("leaves an existing Intl alone", () => {
    const read = vi.fn(() => device(null));
    polyfillIntl(read);
    expect(globalThis.Intl).toBe(realIntl);
    expect(read).not.toHaveBeenCalled();
  });
});
