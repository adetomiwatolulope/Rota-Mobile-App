/**
 * modules/auth/code.test.ts — verification-code generation rules.
 * The code must come from crypto.randomBytes(32); Math.random() and
 * crypto.randomInt() are banned for verification codes. [owner]
 */
import "dotenv/config";
import { describe, expect, it } from "vitest";
import { generate6DigitCode } from "./auth.service.js";

describe("generate6DigitCode [owner: crypto.randomBytes only]", () => {
  it("always returns exactly six digits", () => {
    for (let i = 0; i < 2000; i++) {
      expect(generate6DigitCode()).toMatch(/^\d{6}$/);
    }
  });

  it("does not produce a constant value", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generate6DigitCode());
    expect(seen.size).toBeGreaterThan(100);
  });

  it("spreads each digit roughly evenly (unbiased rejection sampling)", () => {
    const counts = new Array<number>(10).fill(0);
    const iterations = 5000;
    for (let i = 0; i < iterations; i++) {
      for (const ch of generate6DigitCode()) {
        const digit = Number(ch);
        counts[digit] = (counts[digit] ?? 0) + 1;
      }
    }
    const expected = (iterations * 6) / 10;
    const tolerance = expected * 0.15;
    for (const count of counts) {
      expect(Math.abs(count - expected)).toBeLessThan(tolerance);
    }
  });
});
