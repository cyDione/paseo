// Hermes on HarmonyOS ships without `Intl`, so any reference to the global throws
// "Property 'Intl' doesn't exist". This installs the part of `Intl` the app uses.
// It is English-only: `locales` is ignored and output follows en-US.
//
// `Segmenter` and `PluralRules` are left out on purpose. The app and i18next check for
// them and use their own fallbacks.

export interface IntlDeviceInfo {
  timeZone: string | null;
  uses24hourClock: boolean | null;
}

type HourCycle = "h11" | "h12" | "h23" | "h24";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COMPACT_TIERS: readonly (readonly [number, string])[] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];
const CURRENCY_SYMBOLS: Record<string, { symbol: string; digits: number }> = {
  USD: { symbol: "$", digits: 2 },
  EUR: { symbol: "€", digits: 2 },
  GBP: { symbol: "£", digits: 2 },
  JPY: { symbol: "¥", digits: 0 },
  CNY: { symbol: "CN¥", digits: 2 },
};

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function padded(width: "numeric" | "2-digit", value: number): string {
  return width === "2-digit" ? pad2(value) : String(value);
}

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ICU rounds the decimal text of a number ("5.55" goes to "5.6"), while `toFixed` rounds
// the binary value (5.5499... goes to "5.5"). Shifting through exponent notation keeps the
// decimal digits.
function roundHalfUp(value: number, digits: number): number {
  const shortest = String(value);
  if (shortest.includes("e")) return value;
  return Number(`${Math.round(Number(`${shortest}e${digits}`))}e-${digits}`);
}

function formatFixed(
  value: number,
  minFraction: number,
  maxFraction: number,
  grouping: boolean,
): string {
  const [whole, fraction = ""] = roundHalfUp(value, maxFraction).toFixed(maxFraction).split(".");
  let trimmed = fraction;
  while (trimmed.length > minFraction && trimmed.endsWith("0")) {
    trimmed = trimmed.slice(0, -1);
  }
  const integer = grouping ? groupDigits(whole) : whole;
  return trimmed.length > 0 ? `${integer}.${trimmed}` : integer;
}

function readDigits(
  name: string,
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} value is out of range.`);
  }
  return value;
}

function readStyle(options: Intl.NumberFormatOptions): "decimal" | "currency" {
  const style = options.style ?? "decimal";
  if (style !== "decimal" && style !== "currency") {
    throw new RangeError(`Unsupported number style: ${style}`);
  }
  if (style === "currency" && options.currency === undefined) {
    throw new TypeError("Currency code is required with currency style.");
  }
  return style;
}

function readCompact(options: Intl.NumberFormatOptions): boolean {
  const notation = options.notation ?? "standard";
  if (notation !== "standard" && notation !== "compact") {
    throw new RangeError(`Unsupported number notation: ${notation}`);
  }
  return notation === "compact";
}

// Compact notation leaves unset digits to the formatter. Other notations default to the
// currency's digits, or 0 to 3 for decimals.
function resolveFractionDigits(
  options: Intl.NumberFormatOptions,
  compact: boolean,
  style: "decimal" | "currency",
  currency: string | undefined,
): { min: number | undefined; max: number | undefined } {
  const min = readDigits("minimumFractionDigits", options.minimumFractionDigits, -1, 20);
  const max = readDigits("maximumFractionDigits", options.maximumFractionDigits, -1, 20);
  if (min !== -1 && max !== -1 && min > max) {
    throw new RangeError("maximumFractionDigits value is out of range.");
  }
  if (compact) {
    return { min: min === -1 ? undefined : min, max: max === -1 ? undefined : max };
  }
  const defaultDigits =
    style === "currency" ? (CURRENCY_SYMBOLS[currency ?? ""]?.digits ?? 2) : undefined;
  const resolvedMax = max === -1 ? Math.max(defaultDigits ?? 3, min === -1 ? 0 : min) : max;
  return {
    max: resolvedMax,
    min: min === -1 ? Math.min(defaultDigits ?? 0, resolvedMax) : min,
  };
}

class ShimNumberFormat {
  private readonly style: "decimal" | "currency";
  private readonly currency: string | undefined;
  private readonly compact: boolean;
  private readonly grouping: boolean;
  private readonly minFraction: number | undefined;
  private readonly maxFraction: number | undefined;

  constructor(_locales?: string | string[], options: Intl.NumberFormatOptions = {}) {
    const style = readStyle(options);
    this.style = style;
    this.currency = options.currency?.toUpperCase();
    this.compact = readCompact(options);
    this.grouping = options.useGrouping !== false;
    const digits = resolveFractionDigits(options, this.compact, style, this.currency);
    this.minFraction = digits.min;
    this.maxFraction = digits.max;
  }

  format = (input: number | bigint): string => {
    const value = Number(input);
    if (Number.isNaN(value)) return "NaN";
    const negative = value < 0 || Object.is(value, -0);
    const abs = Math.abs(value);
    const body = Number.isFinite(abs) ? this.formatBody(abs) : "∞";
    return `${negative && abs !== 0 ? "-" : ""}${this.withCurrency(body)}`;
  };

  resolvedOptions(): Intl.ResolvedNumberFormatOptions {
    return {
      locale: "en-US",
      numberingSystem: "latn",
      style: this.style,
      currency: this.currency,
      minimumIntegerDigits: 1,
      minimumFractionDigits: this.minFraction ?? 0,
      maximumFractionDigits: this.maxFraction ?? 0,
      useGrouping: this.grouping ? "auto" : false,
      notation: this.compact ? "compact" : "standard",
      signDisplay: "auto",
      roundingMode: "halfExpand",
    } as Intl.ResolvedNumberFormatOptions;
  }

  private withCurrency(body: string): string {
    if (this.style !== "currency" || this.currency === undefined) return body;
    const known = CURRENCY_SYMBOLS[this.currency];
    return `${known?.symbol ?? `${this.currency} `}${body}`;
  }

  private formatBody(abs: number): string {
    if (!this.compact) {
      return formatFixed(abs, this.minFraction ?? 0, this.maxFraction ?? 3, this.grouping);
    }
    let tier = COMPACT_TIERS.findIndex(([threshold]) => abs >= threshold);
    for (;;) {
      const [threshold, suffix] = tier === -1 ? [1, ""] : COMPACT_TIERS[tier];
      const scaled = abs / threshold;
      // Without explicit digits, ICU keeps two significant digits below 10 and rounds to
      // an integer above.
      const maxFraction = this.maxFraction ?? (scaled < 10 ? 1 : 0);
      const minFraction = Math.min(this.minFraction ?? 0, maxFraction);
      const text = formatFixed(scaled, minFraction, maxFraction, false);
      if (Number(text) >= 1000 && tier !== 0) {
        // Rounding carried into the next unit, as 999999 becoming "1M".
        tier = tier === -1 ? COMPACT_TIERS.length - 1 : tier - 1;
        continue;
      }
      return `${text}${suffix}`;
    }
  }
}

interface DateFields {
  weekday?: "long" | "short" | "narrow";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
}

const FIELD_KEYS = ["weekday", "year", "month", "day", "hour", "minute"] as const;

function isUtcName(zone: string): boolean {
  return ["utc", "etc/utc", "gmt", "etc/gmt"].includes(zone.toLowerCase());
}

function nameWidth(name: string, width: "long" | "short" | "narrow"): string {
  if (width === "long") return name;
  return width === "short" ? name.slice(0, 3) : name.slice(0, 1);
}

class ShimDateTimeFormat {
  private readonly fields: DateFields;
  private readonly hourCycle: HourCycle | undefined;
  private readonly utc: boolean;
  private readonly zoneName: string;

  constructor(
    private readonly device: IntlDeviceInfo,
    _locales?: string | string[],
    options: Intl.DateTimeFormatOptions = {},
  ) {
    const deviceZone = device.timeZone ?? "UTC";
    const requested = options.timeZone;
    if (requested === undefined || requested === deviceZone) {
      this.utc = requested === undefined ? isUtcName(deviceZone) : isUtcName(requested);
      this.zoneName = deviceZone;
    } else if (isUtcName(requested)) {
      this.utc = true;
      this.zoneName = "UTC";
    } else {
      throw new RangeError(`Unsupported time zone: ${requested}`);
    }
    const fields: DateFields = {};
    for (const key of FIELD_KEYS) {
      const value = options[key];
      if (value !== undefined) Object.assign(fields, { [key]: value });
    }
    if (FIELD_KEYS.every((key) => fields[key] === undefined)) {
      fields.year = "numeric";
      fields.month = "numeric";
      fields.day = "numeric";
    }
    this.fields = fields;
    this.hourCycle = this.resolveHourCycle(options);
  }

  format = (input?: Date | number): string => {
    const date = input === undefined ? new Date() : new Date(input);
    if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
    const parts = [this.formatDate(date), this.formatTime(date)].filter((part) => part.length > 0);
    return parts.join(", ");
  };

  resolvedOptions(): Intl.ResolvedDateTimeFormatOptions {
    return {
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: this.zoneName,
      ...(this.hourCycle === undefined
        ? {}
        : {
            hourCycle: this.hourCycle,
            hour12: this.hourCycle === "h11" || this.hourCycle === "h12",
          }),
      ...this.fields,
    } as Intl.ResolvedDateTimeFormatOptions;
  }

  private resolveHourCycle(options: Intl.DateTimeFormatOptions): HourCycle | undefined {
    if (this.fields.hour === undefined) return undefined;
    if (options.hour12 !== undefined) return options.hour12 ? "h12" : "h23";
    if (options.hourCycle !== undefined) return options.hourCycle;
    return this.device.uses24hourClock === true ? "h23" : "h12";
  }

  private read(date: Date) {
    return this.utc
      ? {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth(),
          day: date.getUTCDate(),
          weekday: date.getUTCDay(),
          hour: date.getUTCHours(),
          minute: date.getUTCMinutes(),
        }
      : {
          year: date.getFullYear(),
          month: date.getMonth(),
          day: date.getDate(),
          weekday: date.getDay(),
          hour: date.getHours(),
          minute: date.getMinutes(),
        };
  }

  private formatDate(date: Date): string {
    const { weekday, year, month, day } = this.fields;
    if (weekday === undefined && year === undefined && month === undefined && day === undefined) {
      return "";
    }
    const at = this.read(date);
    const dayText = day === undefined ? undefined : padded(day, at.day);
    const yearText =
      year === undefined ? undefined : padded(year, year === "2-digit" ? at.year % 100 : at.year);
    const weekdayText =
      weekday === undefined ? undefined : nameWidth(WEEKDAYS[at.weekday], weekday);

    let rest: string;
    if (month === "long" || month === "short" || month === "narrow") {
      const monthText = nameWidth(MONTHS[at.month], month);
      const monthAndDay = dayText === undefined ? monthText : `${monthText} ${dayText}`;
      rest =
        yearText === undefined
          ? monthAndDay
          : `${monthAndDay}${dayText === undefined ? " " : ", "}${yearText}`;
    } else {
      const monthText = month === undefined ? undefined : padded(month, at.month + 1);
      rest = [monthText, dayText, yearText].filter((part) => part !== undefined).join("/");
    }
    if (weekdayText === undefined) return rest;
    return rest.length > 0 ? `${weekdayText}, ${rest}` : weekdayText;
  }

  private formatTime(date: Date): string {
    const { hour, minute } = this.fields;
    if (hour === undefined && minute === undefined) return "";
    const at = this.read(date);
    if (hour === undefined) {
      return minute === "2-digit" ? pad2(at.minute) : String(at.minute);
    }
    const cycle = this.hourCycle ?? "h12";
    const twelve = cycle === "h11" || cycle === "h12";
    let hours = at.hour;
    if (twelve) {
      hours = cycle === "h12" ? at.hour % 12 || 12 : at.hour % 12;
    } else if (cycle === "h24") {
      hours = at.hour || 24;
    }
    const hourText = !twelve || hour === "2-digit" ? pad2(hours) : String(hours);
    const clock = minute === undefined ? hourText : `${hourText}:${pad2(at.minute)}`;
    return twelve ? `${clock} ${at.hour < 12 ? "AM" : "PM"}` : clock;
  }
}

interface IntlConstructor<Instance, Options> {
  (locales?: string | string[], options?: Options): Instance;
  new (locales?: string | string[], options?: Options): Instance;
}

// `Intl.DateTimeFormat()` is also called without `new`, so these are plain functions. A
// function that returns an object works either way; TypeScript cannot express that, hence
// the one cast.
function callableConstructor<Instance extends object, Options>(
  create: (locales: string | string[] | undefined, options: Options | undefined) => Instance,
  prototype: Instance,
): IntlConstructor<Instance, Options> {
  function construct(locales?: string | string[], options?: Options): Instance {
    return create(locales, options);
  }
  construct.prototype = prototype;
  return construct as unknown as IntlConstructor<Instance, Options>;
}

export function createIntlShim(device: IntlDeviceInfo) {
  return {
    DateTimeFormat: callableConstructor<ShimDateTimeFormat, Intl.DateTimeFormatOptions>(
      (locales, options) => new ShimDateTimeFormat(device, locales, options),
      ShimDateTimeFormat.prototype,
    ),
    NumberFormat: callableConstructor<ShimNumberFormat, Intl.NumberFormatOptions>(
      (locales, options) => new ShimNumberFormat(locales, options),
      ShimNumberFormat.prototype,
    ),
  };
}

export function polyfillIntl(readDevice: () => IntlDeviceInfo): void {
  if (typeof globalThis.Intl !== "undefined") return;
  Object.defineProperty(globalThis, "Intl", {
    value: createIntlShim(readDevice()),
    configurable: true,
    writable: true,
  });
}
