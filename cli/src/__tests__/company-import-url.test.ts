import { describe, expect, it } from "vitest";
import {
  isGithubShorthand,
  looksLikeRepoUrl,
  isHttpUrl,
  normalizeGithubImportSource,
  validateExportOptions,
  validateImportSource,
  validateImportOptions,
} from "../commands/client/company.js";

describe("isHttpUrl", () => {
  it("matches http URLs", () => {
    expect(isHttpUrl("http://example.com/foo")).toBe(true);
  });

  it("matches https URLs", () => {
    expect(isHttpUrl("https://example.com/foo")).toBe(true);
  });

  it("rejects local paths", () => {
    expect(isHttpUrl("/tmp/my-company")).toBe(false);
    expect(isHttpUrl("./relative")).toBe(false);
  });
});

describe("looksLikeRepoUrl", () => {
  it("matches GitHub URLs", () => {
    expect(looksLikeRepoUrl("https://github.com/org/repo")).toBe(true);
  });

  it("rejects URLs without owner/repo path", () => {
    expect(looksLikeRepoUrl("https://example.com/foo")).toBe(false);
  });

  it("rejects local paths", () => {
    expect(looksLikeRepoUrl("/tmp/my-company")).toBe(false);
  });
});

describe("isGithubShorthand", () => {
  it("matches owner/repo/path shorthands", () => {
    expect(isGithubShorthand("paperclipai/companies/gstack")).toBe(true);
    expect(isGithubShorthand("paperclipai/companies")).toBe(true);
  });

  it("rejects local-looking paths", () => {
    expect(isGithubShorthand("./exports/acme")).toBe(false);
    expect(isGithubShorthand("/tmp/acme")).toBe(false);
    expect(isGithubShorthand("C:\\temp\\acme")).toBe(false);
  });
});

describe("normalizeGithubImportSource", () => {
  it("normalizes shorthand imports to canonical GitHub sources", () => {
    expect(normalizeGithubImportSource("paperclipai/companies/gstack")).toBe(
      "https://github.com/paperclipai/companies?ref=main&path=gstack",
    );
  });

  it("applies --ref to shorthand imports", () => {
    expect(normalizeGithubImportSource("paperclipai/companies/gstack", "feature/demo")).toBe(
      "https://github.com/paperclipai/companies?ref=feature%2Fdemo&path=gstack",
    );
  });

  it("applies --ref to existing GitHub tree URLs without losing the package path", () => {
    expect(
      normalizeGithubImportSource(
        "https://github.com/paperclipai/companies/tree/main/gstack",
        "release/2026-03-23",
      ),
    ).toBe(
      "https://github.com/paperclipai/companies?ref=release%2F2026-03-23&path=gstack",
    );
  });
});

describe("validateExportOptions", () => {
  it("accepts valid --include values", () => {
    expect(() =>
      validateExportOptions({ include: "company,agents,projects" }),
    ).not.toThrow();
  });

  it("accepts valid --include with tasks alias for issues", () => {
    expect(() =>
      validateExportOptions({ include: "company,tasks,skills" }),
    ).not.toThrow();
  });

  it("accepts valid --skills", () => {
    expect(() =>
      validateExportOptions({ skills: "skill1,skill2,skill3" }),
    ).not.toThrow();
  });

  it("accepts valid --projects", () => {
    expect(() =>
      validateExportOptions({ projects: "proj1,proj2" }),
    ).not.toThrow();
  });

  it("accepts valid --issues", () => {
    expect(() =>
      validateExportOptions({ issues: "ISS-001,ISS-002" }),
    ).not.toThrow();
  });

  it("accepts valid --project-issues", () => {
    expect(() =>
      validateExportOptions({ projectIssues: "my-project,other-project" }),
    ).not.toThrow();
  });

  it("accepts empty options (all optional)", () => {
    expect(() => validateExportOptions({})).not.toThrow();
  });

  it("accepts all valid include values together", () => {
    expect(() =>
      validateExportOptions({
        include: "company,agents,projects,issues,skills",
        skills: "skill1",
        projects: "proj1",
        issues: "ISS-001",
        projectIssues: "proj1",
      }),
    ).not.toThrow();
  });

  it("rejects --include with invalid value", () => {
    expect(() => validateExportOptions({ include: "invalid,garbage" })).toThrow();
    expect(() => validateExportOptions({ include: "company,foo" })).toThrow();
  });

  it("rejects empty --skills string", () => {
    expect(() => validateExportOptions({ skills: "" })).toThrow("--skills: cannot be empty");
  });

  it("rejects empty --projects string", () => {
    expect(() => validateExportOptions({ projects: "" })).toThrow("--projects: cannot be empty");
  });

  it("rejects empty --issues string", () => {
    expect(() => validateExportOptions({ issues: "" })).toThrow("--issues: cannot be empty");
  });

  it("rejects empty --project-issues string", () => {
    expect(() => validateExportOptions({ projectIssues: "" })).toThrow("--project-issues: cannot be empty");
  });
});

describe("validateImportSource", () => {
  it("rejects empty source", () => {
    expect(() => validateImportSource({ from: "", ref: undefined, isPath: false })).toThrow(
      "source path or URL is required",
    );
  });

  it("accepts non-empty source", () => {
    expect(() => validateImportSource({ from: "https://github.com/org/repo", ref: undefined, isPath: false })).not.toThrow();
    expect(() => validateImportSource({ from: "/tmp/my-company", ref: undefined, isPath: true })).not.toThrow();
  });

  it("rejects --ref for non-GitHub sources when isPath=false", () => {
    expect(() => validateImportSource({ from: "https://example.com/not-github", ref: "main", isPath: false })).toThrow(
      "--ref is only supported for GitHub import sources",
    );
  });

  it("accepts --ref for GitHub URLs", () => {
    expect(() => validateImportSource({ from: "https://github.com/org/repo", ref: "main", isPath: false })).not.toThrow();
  });

  it("accepts --ref for GitHub shorthands", () => {
    expect(() => validateImportSource({ from: "org/repo", ref: "main", isPath: false })).not.toThrow();
  });

  it("allows --ref for path sources", () => {
    expect(() => validateImportSource({ from: "/tmp/my-company", ref: "main", isPath: true })).not.toThrow();
  });
});

describe("validateImportOptions", () => {
  it("accepts valid --target values", () => {
    expect(() => validateImportOptions({ target: "new" })).not.toThrow();
    expect(() => validateImportOptions({ target: "existing" })).not.toThrow();
  });

  it("accepts valid --collision values", () => {
    expect(() => validateImportOptions({ collision: "rename" })).not.toThrow();
    expect(() => validateImportOptions({ collision: "skip" })).not.toThrow();
    expect(() => validateImportOptions({ collision: "replace" })).not.toThrow();
  });

  it("accepts valid --include values", () => {
    expect(() => validateImportOptions({ include: "company,agents,projects,issues,skills" })).not.toThrow();
  });

  it("accepts valid --company-id UUID", () => {
    expect(() =>
      validateImportOptions({
        target: "existing",
        companyId: "342fdeb0-39b7-4864-8154-a195f5103834",
      }),
    ).not.toThrow();
  });

  it("accepts empty options (all optional)", () => {
    expect(() => validateImportOptions({})).not.toThrow();
  });

  it("rejects invalid --target value", () => {
    expect(() => validateImportOptions({ target: "invalid" })).toThrow("--target: must be 'new' or 'existing'");
  });

  it("rejects invalid --collision value", () => {
    expect(() => validateImportOptions({ collision: "invalid" })).toThrow(
      "--collision: must be 'rename', 'skip', or 'replace'",
    );
  });

  it("rejects --include with invalid value", () => {
    expect(() => validateImportOptions({ include: "foo,bar" })).toThrow();
  });

  it("rejects malformed --company-id UUID", () => {
    expect(() =>
      validateImportOptions({
        target: "existing",
        companyId: "not-a-uuid",
      }),
    ).toThrow("--company-id: must be a valid UUID");
  });

  it("rejects empty --new-company-name when target is new", () => {
    expect(() =>
      validateImportOptions({
        target: "new",
        newCompanyName: "",
      }),
    ).toThrow("--new-company-name: cannot be empty when specified");
  });

  it("rejects empty --agents", () => {
    expect(() => validateImportOptions({ agents: "" })).toThrow("--agents: cannot be empty");
  });
});
