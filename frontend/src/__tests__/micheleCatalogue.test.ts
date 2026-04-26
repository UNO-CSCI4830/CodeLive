import { describe, it, expect, beforeEach } from "vitest";
import { getCached, setCache, clearCache } from "../lib/queryCache";
import { getCategoryBySlug, categories } from "../pages/question-catalogue/data/catalogueData";

describe("Michele catalogue and cache unit tests", () => {
  beforeEach(() => {
    clearCache();
  });

  it("setCache stores data and getCached retrieves it", () => {
    setCache("user-role", "interviewer");

    expect(getCached<string>("user-role")).toBe("interviewer");
  });

  it("clearCache removes one cached item by key", () => {
    setCache("session", "active");
    setCache("role", "candidate");

    clearCache("session");

    expect(getCached<string>("session")).toBeUndefined();
    expect(getCached<string>("role")).toBe("candidate");
  });

  it("clearCache removes all cached items when no key is provided", () => {
    setCache("session", "active");
    setCache("role", "candidate");

    clearCache();

    expect(getCached<string>("session")).toBeUndefined();
    expect(getCached<string>("role")).toBeUndefined();
  });

  it("getCategoryBySlug returns the frontend category", () => {
    const category = getCategoryBySlug("frontend");

    expect(category).toBeDefined();
    expect(category?.slug).toBe("frontend");
    expect(category?.label).toBe("Frontend");
  });

  it("categories includes backend and database bridge categories", () => {
    const categorySlugs = categories.map((category) => category.slug);

    expect(categorySlugs).toContain("backend");
    expect(categorySlugs).toContain("database");
  });
});