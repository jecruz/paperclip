import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 3 levels up from cli/src/__tests__/ -> cli/src/ -> cli/ -> project root
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function runCli(args: string[]): { exitCode: number; output: string } {
  try {
    const result = execFileSync("pnpm", ["--silent", "paperclipai", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        PAPERCLIP_API_URL: "http://127.0.0.1:65535",
        PAPERCLIP_API_KEY: "n/a",
      },
    });
    return { exitCode: 0, output: result };
  } catch (e: any) {
    return {
      exitCode: e.status ?? 1,
      output: (e.stderr ?? "") + (e.stdout ?? ""),
    };
  }
}

describe("paperclipai company export --validation", () => {
  it("exits with error when --include has invalid value", () => {
    const result = runCli(["company", "export", "00000000-0000-0000-0000-000000000000", "--out", "/tmp/pc-export-test", "--include", "garbage,invalid"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--include/i);
  });

  it("exits with error when --skills is empty", () => {
    const result = runCli(["company", "export", "00000000-0000-0000-0000-000000000000", "--out", "/tmp/pc-export-test", "--skills", ""]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--skills.*empty/i);
  });

  it("exits with error when --projects is empty", () => {
    const result = runCli(["company", "export", "00000000-0000-0000-0000-000000000000", "--out", "/tmp/pc-export-test", "--projects", ""]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--projects.*empty/i);
  });

  it("exits with error when --issues is empty", () => {
    const result = runCli(["company", "export", "00000000-0000-0000-0000-000000000000", "--out", "/tmp/pc-export-test", "--issues", ""]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--issues.*empty/i);
  });
});

describe("paperclipai company import --validation", () => {
  it("exits with error when --target has invalid value", () => {
    const result = runCli(["company", "import", "/tmp/nonexistent", "--target", "invalid"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--target/i);
  });

  it("exits with error when --collision has invalid value", () => {
    const result = runCli(["company", "import", "/tmp/nonexistent", "--collision", "badrandom"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--collision/i);
  });

  it("exits with error when --company-id is not a UUID", () => {
    const result = runCli(["company", "import", "/tmp/nonexistent", "--target", "existing", "--company-id", "not-a-uuid"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--company-id/i);
  });

  it("exits with error when --include has invalid value", () => {
    const result = runCli(["company", "import", "/tmp/nonexistent", "--include", "foo,bar,baz"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toMatch(/--include/i);
  });
});
