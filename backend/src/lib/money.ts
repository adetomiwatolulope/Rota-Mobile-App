/**
 * lib/money.ts - money helpers. [M-1, M-2]
 * All amounts in integer kobo. Conversions only here/adapter; call adapter only
 * from Flutterwave code.
 */
export function assertIntegerCents(value: number): asserts value is number {
  if (!Number.isInteger(value)) {
    throw new Error("Amount must be an integer in minor units");
  }
}

export function assertNonNegative(value: number): number {
  if (value < 0) {
    throw new Error("Amount must be non-negative");
  }
  return value;
}

export function koboToFlutterwaveAmount(kobo: number): number {
  assertIntegerCents(kobo);
  assertNonNegative(kobo);
  // Flutterwave expects amount in major units (e.g. 2000.00). Use exact decimal
  // for NGN (2 dp). Safe for values within integer precision.
  const major = kobo / 100;
  // Avoid floating point representation errors for integer kobo.
  return Number(major.toFixed(2));
}

export function flutterwaveMajorToKobo(amount: unknown): number {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new Error("Invalid amount");
    }
    const kobo = Math.round(amount * 100);
    if (kobo < 0) {
      throw new Error("Invalid amount");
    }
    return kobo;
  }
  if (typeof amount === "string") {
    const s = amount.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
      throw new Error("Invalid amount");
    }
    const isNegative = s.startsWith("-");
    const num = s.replace("-", "");
    const [whole, frac = ""] = num.split(".");
    const f2 = (frac + "00").slice(0, 2);
    const kobo = Number(whole || "0") * 100 + Number(f2 || "0");
    if (isNegative) {
      throw new Error("Invalid amount");
    }
    return kobo;
  }
  throw new Error("Invalid amount");
}

export function floorDivide(numerator: number, divisor: number): number {
  if (divisor <= 0) {
    throw new Error("Invalid divisor");
  }
  return Math.floor(numerator / divisor);
}
