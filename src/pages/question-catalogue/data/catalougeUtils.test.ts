import { describe, it, expect, beforeEach } from "vitest";
 
const cache = new Map<string, unknown>();
 
function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}
 
function setCache(key: string, data: unknown): void {
  cache.set(key, data);
}
 
function clearCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
 
type Difficulty = "easy" | "medium" | "hard";
 
interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags?: string[];
}
 
interface SubCategory {
  slug: string;
  label: string;
  problems: Problem[];
}
 
interface Category {
  slug: string;
  label: string;
  description: string;
  icon: string;
  problemCount: number;
  subCategories: SubCategory[];
}
 
const testCategories: Category[] = [
  {
    slug: "frontend",
    label: "Frontend",
    description: "React challenges.",
    icon: "Monitor",
    problemCount: 2,
    subCategories: [
      {
        slug: "hook",
        label: "Custom Hooks",
        problems: [
          { id: "hook-use-toggle", title: "useToggle Hook", difficulty: "easy" },
          { id: "hook-use-debounce", title: "useDebounce Hook", difficulty: "medium" },
        ],
      },
    ],
  },
  {
    slug: "leetcode",
    label: "LeetCode",
    description: "Algorithms.",
    icon: "Code",
    problemCount: 0,
    subCategories: [],
  },
  {
    slug: "backend",
    label: "Backend",
    description: "API design.",
    icon: "Server",
    problemCount: 0,
    subCategories: [],
  },
  {
    slug: "database",
    label: "Database",
    description: "SQL challenges.",
    icon: "Database",
    problemCount: 0,
    subCategories: [],
  },
];
 
function getCategoryBySlug(slug: string): Category | undefined {
  return testCategories.find((cat) => cat.slug === slug);
}
 
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
 
function cloneCategories(categories: Category[]): Category[] {
  return categories.map((cat) => ({
    ...cat,
    subCategories: cat.subCategories.map((sub) => ({
      ...sub,
      problems: sub.problems.map((p) => ({ ...p })),
    })),
  }));
}
 
function mergeCategoryIntoCategories(
  baseCategories: Category[],
  targetSlug: string,
  newSubCategories: SubCategory[],
  newDescription: string,
): Category[] {
  const copy = cloneCategories(baseCategories);
  return copy.map((cat) => {
    if (cat.slug !== targetSlug) return cat;
    const total = newSubCategories.reduce((count, sub) => count + sub.problems.length, 0);
    return { ...cat, problemCount: total, subCategories: newSubCategories, description: newDescription };
  });
}
 
function mergeBackendIntoCategories(
  baseCategories: Category[],
  backendSubs: SubCategory[],
): Category[] {
  return mergeCategoryIntoCategories(
    baseCategories,
    "backend",
    backendSubs,
    "FastAPI backend challenges covering API design, auth, middleware, resilience, async patterns, and observability.",
  );
}
 
function mergeDatabaseIntoCategories(
  baseCategories: Category[],
  dbSubs: SubCategory[],
): Category[] {
  return mergeCategoryIntoCategories(
    baseCategories,
    "database",
    dbSubs,
    "SQLite SQL interview challenges covering filtering, joins, aggregation, CTEs, window functions, and time-based analytics.",
  );
}
 
describe("getCategoryBySlug", () => {
  it("returns the correct category for a known slug", () => {
    const result = getCategoryBySlug("frontend");
 
    expect(result).toBeDefined();
    expect(result!.slug).toBe("frontend");
    expect(result!.label).toBe("Frontend");
  });
 
  it("returns undefined for an unknown slug", () => {
    const result = getCategoryBySlug("does-not-exist");
 
    expect(result).toBeUndefined();
  });
 
  it("is case-sensitive and does not match uppercase slugs", () => {
    const result = getCategoryBySlug("Frontend");
 
    expect(result).toBeUndefined();
  });
 
  it("returns undefined for an empty string", () => {
    const result = getCategoryBySlug("");
 
    expect(result).toBeUndefined();
  });
 
  it("returns the leetcode category correctly", () => {
    const result = getCategoryBySlug("leetcode");
 
    expect(result).toBeDefined();
    expect(result!.icon).toBe("Code");
  });
});
 
describe("titleCaseSlug", () => {
  it("title-cases a single-word slug", () => {
    expect(titleCaseSlug("backend")).toBe("Backend");
  });
 
  it("title-cases each word in a multi-word hyphenated slug", () => {
    expect(titleCaseSlug("api-design")).toBe("Api Design");
  });
 
  it("handles a three-part slug correctly", () => {
    expect(titleCaseSlug("auth-security-middleware")).toBe("Auth Security Middleware");
  });
 
  it("returns an empty string unchanged", () => {
    expect(titleCaseSlug("")).toBe("");
  });
 
  it("does not change a slug that already starts with a capital letter", () => {
    expect(titleCaseSlug("Background-Jobs")).toBe("Background Jobs");
  });
 
  it("handles slugs with numbers, leaving digits intact", () => {
    expect(titleCaseSlug("sql-101")).toBe("Sql 101");
  });
});
 
describe("queryCache", () => {
  beforeEach(() => {
    clearCache();
  });
 
  it("returns undefined for a key that has never been set", () => {
    const result = getCached("missing-key");
 
    expect(result).toBeUndefined();
  });
 
  it("returns the value that was previously stored", () => {
    setCache("user-profile", { name: "Alice", role: "interviewer" });
 
    const result = getCached<{ name: string; role: string }>("user-profile");
 
    expect(result).toEqual({ name: "Alice", role: "interviewer" });
  });
 
  it("overwrites an existing key with a new value", () => {
    setCache("session-id", "abc-123");
    setCache("session-id", "xyz-999");
 
    expect(getCached("session-id")).toBe("xyz-999");
  });
 
  it("clears only the specified key and leaves others alone", () => {
    setCache("key-a", 42);
    setCache("key-b", 99);
 
    clearCache("key-a");
 
    expect(getCached("key-a")).toBeUndefined();
    expect(getCached("key-b")).toBe(99);
  });
 
  it("clears everything when called without an argument", () => {
    setCache("alpha", true);
    setCache("beta", false);
 
    clearCache();
 
    expect(getCached("alpha")).toBeUndefined();
    expect(getCached("beta")).toBeUndefined();
  });
 
  it("stores and retrieves array values correctly", () => {
    const problems = [
      { id: "p1", title: "Reverse List", difficulty: "easy" },
      { id: "p2", title: "Two Sum", difficulty: "medium" },
    ];
 
    setCache("problems-list", problems);
 
    expect(getCached("problems-list")).toEqual(problems);
  });
});
 
describe("mergeBackendIntoCategories", () => {
  const backendSubs: SubCategory[] = [
    {
      slug: "api-design",
      label: "Api Design",
      problems: [
        { id: "paginated-users-list", title: "Paginated Users List", difficulty: "medium", tags: ["backend", "api-design"] },
        { id: "idempotent-order-create", title: "Idempotent Order Create", difficulty: "hard", tags: ["backend", "api-design"] },
      ],
    },
    {
      slug: "auth-security",
      label: "Auth Security",
      problems: [
        { id: "api-key-guard", title: "API Key Guard", difficulty: "medium", tags: ["backend", "auth-security"] },
      ],
    },
  ];
 
  it("sets the backend category's subCategories to the provided list", () => {
    const merged = mergeBackendIntoCategories(testCategories, backendSubs);
    const backend = merged.find((c) => c.slug === "backend")!;
 
    expect(backend.subCategories).toHaveLength(2);
    expect(backend.subCategories[0].slug).toBe("api-design");
  });
 
  it("calculates problemCount as the total across all sub-categories", () => {
    const merged = mergeBackendIntoCategories(testCategories, backendSubs);
    const backend = merged.find((c) => c.slug === "backend")!;
 
    expect(backend.problemCount).toBe(3);
  });
 
  it("does not touch categories other than backend", () => {
    const merged = mergeBackendIntoCategories(testCategories, backendSubs);
    const frontend = merged.find((c) => c.slug === "frontend")!;
 
    expect(frontend.subCategories).toHaveLength(1);
    expect(frontend.problemCount).toBe(2);
  });
 
  it("does not mutate the original categories array", () => {
    const originalBackend = testCategories.find((c) => c.slug === "backend")!;
    const originalCount = originalBackend.subCategories.length;
 
    mergeBackendIntoCategories(testCategories, backendSubs);
 
    expect(originalBackend.subCategories).toHaveLength(originalCount);
  });
 
  it("updates the backend description correctly", () => {
    const merged = mergeBackendIntoCategories(testCategories, backendSubs);
    const backend = merged.find((c) => c.slug === "backend")!;
 
    expect(backend.description).toMatch(/FastAPI/);
  });
});
 
describe("mergeDatabaseIntoCategories", () => {
  const dbSubs: SubCategory[] = [
    {
      slug: "aggregations-grouping",
      label: "Aggregations Grouping",
      problems: [
        { id: "monthly-revenue", title: "Monthly Revenue", difficulty: "medium", tags: ["database", "aggregations-grouping"] },
      ],
    },
  ];
 
  it("sets the database category's subCategories correctly", () => {
    const merged = mergeDatabaseIntoCategories(testCategories, dbSubs);
    const db = merged.find((c) => c.slug === "database")!;
 
    expect(db.subCategories).toHaveLength(1);
    expect(db.subCategories[0].slug).toBe("aggregations-grouping");
  });
 
  it("correctly sets problemCount for the database category", () => {
    const merged = mergeDatabaseIntoCategories(testCategories, dbSubs);
    const db = merged.find((c) => c.slug === "database")!;
 
    expect(db.problemCount).toBe(1);
  });
 
  it("leaves the backend category untouched when merging database", () => {
    const merged = mergeDatabaseIntoCategories(testCategories, dbSubs);
    const backend = merged.find((c) => c.slug === "backend")!;
 
    expect(backend.subCategories).toHaveLength(0);
    expect(backend.problemCount).toBe(0);
  });
 
  it("updates the database description correctly", () => {
    const merged = mergeDatabaseIntoCategories(testCategories, dbSubs);
    const db = merged.find((c) => c.slug === "database")!;
 
    expect(db.description).toMatch(/SQLite/);
  });
});