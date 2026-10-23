import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
  failedPasswordRules,
  isPasswordValid,
  visiblePasswordRules,
} from "./index.js";

describe("password policy [FR-001]", () => {
  it("enforces a minimum length of 8", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(64);
    expect(isPasswordValid("Short1")).toBe(false);
    expect(isPasswordValid("lowercaseonly")).toBe(true);
  });

  it("enforces a maximum length of 64", () => {
    const ok = "a".repeat(PASSWORD_MAX_LENGTH);
    const tooLong = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    expect(isPasswordValid(ok)).toBe(true);
    expect(isPasswordValid(tooLong)).toBe(false);
  });

  it("treats composition as advisory: a long all-lowercase password is valid", () => {
    expect(isPasswordValid("abcdefghijklmnop")).toBe(true);
    expect(isPasswordValid("123456789012")).toBe(true);
  });

  it("still reports missing composition rules as failed (for hints)", () => {
    const failed = failedPasswordRules("ABCDEFGHIJKL");
    expect(failed).toContain("lowercase");
    expect(failed).toContain("number");
    expect(failed).toContain("special");
  });

  it("lists the length rule last in the rule definitions", () => {
    expect(PASSWORD_RULES.at(-1)?.id).toBe("length");
  });

  it("hides the length hint once the length rule is met", () => {
    const visible = visiblePasswordRules("lowercaseonly").map((r) => r.id);
    expect(visible).not.toContain("length");
  });

  it("shows the enforced length hint before advisory hints", () => {
    const first = visiblePasswordRules("Abc")[0];
    expect(first?.id).toBe("length");
    expect(first?.advisoryOnly).toBeFalsy();
  });
});
