import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";



/**
 * from session.ts
 * generates a join code for an interview session
 */
function generateJoinCode(): string {
  return uuidv4().replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * from session.ts
 * ensures that time limits are valid for interviews
 */
function safeTimeLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.floor(parsed);
}

/**
 * from session.ts
 * extracts and returns the last name from a full name
 * will return null if a non-full-name string is entered
 */
function extractLastName(fullName: string): string | null {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return null;
  return parts[parts.length - 1];
}

// Tests: generateJoinCode()

describe("generateJoinCode()", () => {
    // Test 1
    it("generates a 6-character alphanumeric code", () => {
        const code = generateJoinCode();
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    // Test 2
    it("return's uppercase characters only", () => {
        const code = generateJoinCode();
        expect(code).toBe(code.toUpperCase());
    });

    // Test 3
    it("does not contain hyphens", () => {
        const code = generateJoinCode();
        expect(code).not.toContain("-");
    });

    // Test 4
    it("generates unique codes (no duplicates in batch)", () => {
        const codes = new Set();
        for (let i = 0; i < 100; i++) {
        codes.add(generateJoinCode());
        }
        // should have 100 unique codes statistically
        expect(codes.size).toBeGreaterThan(90);
    });
});

// Tests: safeTimeLimit()

describe("safeTimeLimit()", () => {
    // Test 1
    it("return's the floored number when given a positive finite number", () => {
        expect(safeTimeLimit(50)).toBe(50);
        expect(safeTimeLimit(50.7)).toBe(50);
        expect(safeTimeLimit(40.2)).toBe(40);
    });

    // Test 2
    it("return's 30 as default for zero or negative numbers", () => {
        expect(safeTimeLimit(0)).toBe(30);
        expect(safeTimeLimit(-5)).toBe(30);
        expect(safeTimeLimit(-100)).toBe(30);
    });
    // Test 3
    it("return's 30 as default for non-finite numbers", () => {
        expect(safeTimeLimit(Infinity)).toBe(30);
        expect(safeTimeLimit(-Infinity)).toBe(30);
        expect(safeTimeLimit(NaN)).toBe(30);
    });
    // Test 4
    it("return's 30 as default for non-numeric strings that don't parse", () => {
        expect(safeTimeLimit("abc")).toBe(30);
        expect(safeTimeLimit("")).toBe(30);
        expect(safeTimeLimit("12abc")).toBe(30);
    });
});


// Tests: extractLastName()
// there are a lot more scenarios for extractLastName() so it recieved some additional test cases from me
describe("extractLastName()", () => {

    // Test 1
    it("return's the last name from a full name with two words", () => {
        expect(extractLastName("Hunter Neff")).toBe("Neff");
    });

    // Test 2
    it("return's the last name from a full name with multiple words", () => {
        expect(extractLastName("Hunter Ryan Neff")).toBe("Neff");
        expect(extractLastName("Hunter Ryan TEST Neff")).toBe("Neff");
    });

    // Test 3
    it("handle's extra whitespace correctly", () => {
        expect(extractLastName("Hunter   Neff")).toBe("Neff");
        expect(extractLastName("  Hunter Neff  ")).toBe("Neff");
        expect(extractLastName("Hunter\t\tNeff")).toBe("Neff");
    });

    // Test 4
    it("return's null for single-word names", () => {
        expect(extractLastName("Hunter")).toBeNull();
        expect(extractLastName("Sevan")).toBeNull();
    });

    // Test 5
    it("return's null for empty strings", () => {
        expect(extractLastName("")).toBeNull();
    });

    // Test 6
    it("return's null for whitespace-only strings", () => {
        expect(extractLastName("   ")).toBeNull();
        expect(extractLastName("\t\t\t")).toBeNull();
    });

    // Test 7
    it("trim's individual parts before processing", () => {
        expect(extractLastName("Hunter  \t  Neff")).toBe("Neff");
        expect(extractLastName("  Hunter  \t  Ryan  Neff  ")).toBe("Neff");
    });
    // Test 8
    it("handle's names with leading/trailing spaces in parts", () => {
        expect(extractLastName(" Hunter   Neff ")).toBe("Neff");
    });
});
