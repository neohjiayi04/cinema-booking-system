// Jest-style console reporter for Vitest.
//
//   PASS  src/pages/admin/Halls.test.jsx
//     Halls Admin Page
//       ✓ should display the page heading and description (12 ms)
//       ✕ should reject a hall with a blank name (45 ms)
//
//   Test Suites: 1 failed, 11 passed, 12 total
//   Tests:       2 failed, 150 passed, 152 total
//   Time:        8.31 s
//
// Works with Vitest 3+/4+/5 (onTestRunEnd) and falls back to the older
// onFinished API (Vitest 1/2), so it keeps working if you change versions.

import path from "node:path";

const useColor = process.stdout.isTTY || process.env.FORCE_COLOR;
const c = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));

const green = (t) => c("32", t);
const red = (t) => c("31", t);
const yellow = (t) => c("33", t);
const dim = (t) => c("2", t);
const bold = (t) => c("1", t);
const passBadge = () => (useColor ? "\x1b[30;42;1m PASS \x1b[0m" : " PASS ");
const failBadge = () => (useColor ? "\x1b[97;41;1m FAIL \x1b[0m" : " FAIL ");

// Windows consoles often cannot draw the check mark / cross.
const isWindows = process.platform === "win32";
const TICK = isWindows ? "√" : "✓";
const CROSS = isWindows ? "×" : "✕";
const SKIP = "○";

const stripAnsi = (text) => String(text ?? "").replace(/\x1b\[[0-9;]*m/g, "");
const toPosix = (p) => String(p).replace(/\\/g, "/");
const pad = (depth) => "  ".repeat(depth);
const fmtMs = (ms) => `${Math.round(Number(ms) || 0)} ms`;

function shortError(error) {
  if (!error) return "Unknown error";
  const message = stripAnsi(error.message || String(error));
  const lines = message.split("\n");
  // Keep the useful start of the message (matcher text + a bit of DOM / diff)
  const kept = lines.slice(0, 14);
  if (lines.length > kept.length) kept.push("...");
  return kept.join("\n");
}

export default class JestStyleReporter {
  constructor() {
    this.start = Date.now();
    this.printed = false;
    this.root = process.cwd();
  }

  onInit(ctx) {
    this.start = Date.now();
    if (ctx?.config?.root) this.root = ctx.config.root;
  }

  // ---- Vitest 3 / 4 / 5 -------------------------------------------------
  onTestRunEnd(testModules) {
    if (this.printed) return;

    const files = [...testModules].map((module) => {
      const relative = toPosix(
        module.relativeModuleId ||
          path.relative(this.root, module.moduleId || module.id || "")
      );

      const items = [];
      let moduleState = "passed";

      try {
        moduleState = module.state();
      } catch {
        // ignore
      }

      const walk = (children, depth) => {
        for (const child of children) {
          if (child.type === "suite") {
            items.push({ kind: "suite", name: child.name, depth });
            walk(child.children, depth + 1);
          } else if (child.type === "test") {
            const result = child.result();
            const state =
              result.state === "failed"
                ? "failed"
                : result.state === "passed"
                  ? "passed"
                  : "skipped";
            let duration = 0;
            try {
              duration = child.diagnostic()?.duration ?? 0;
            } catch {
              // ignore
            }
            items.push({
              kind: "test",
              name: child.name,
              fullName: child.fullName,
              depth,
              state,
              duration,
              errors: result.errors || []
            });
          }
        }
      };

      walk(module.children, 1);

      let moduleErrors = [];
      try {
        moduleErrors = module.errors?.() || [];
      } catch {
        // ignore
      }

      return {
        file: relative,
        failed: moduleState === "failed" || items.some((i) => i.state === "failed"),
        items,
        moduleErrors
      };
    });

    this.print(files);
  }

  // ---- Vitest 1 / 2 -----------------------------------------------------
  onFinished(files = []) {
    if (this.printed) return;

    const mapped = files.map((file) => {
      const items = [];

      const walk = (tasks, depth) => {
        for (const task of tasks || []) {
          if (task.type === "suite") {
            items.push({ kind: "suite", name: task.name, depth });
            walk(task.tasks, depth + 1);
          } else {
            const raw = task.result?.state;
            const state =
              raw === "fail" ? "failed" : raw === "pass" ? "passed" : "skipped";
            items.push({
              kind: "test",
              name: task.name,
              depth,
              state,
              duration: task.result?.duration ?? 0,
              errors: task.result?.errors || [],
              fullName: [file.name, task.name].join(" > ")
            });
          }
        }
      };

      walk(file.tasks, 1);

      return {
        file: toPosix(file.name || path.relative(this.root, file.filepath || "")),
        failed: file.result?.state === "fail" || items.some((i) => i.state === "failed"),
        items,
        moduleErrors: file.result?.state === "fail" && !items.length
          ? file.result.errors || []
          : []
      };
    });

    this.print(mapped);
  }

  // ---- Output -----------------------------------------------------------
  print(files) {
    this.printed = true;
    files.sort((a, b) => a.file.localeCompare(b.file));

    const out = [];
    const failures = [];

    for (const file of files) {
      out.push("");
      out.push(`${file.failed ? failBadge() : passBadge()} ${dim(path.posix.dirname(file.file) + "/")}${bold(path.posix.basename(file.file))}`);

      // Print a suite heading only once, in front of its first test
      const stack = [];

      for (const item of file.items) {
        if (item.kind === "suite") {
          stack.length = item.depth - 1;
          stack[item.depth - 1] = item;
          continue;
        }

        // print any suite headings that have not been shown yet
        for (let d = 0; d < item.depth - 1; d++) {
          if (stack[d] && !stack[d].printed) {
            out.push(`${pad(d + 1)}${bold(stack[d].name)}`);
            stack[d].printed = true;
          }
        }

        const time = dim(`(${fmtMs(item.duration)})`);

        if (item.state === "passed") {
          out.push(`${pad(item.depth)}${green(TICK)} ${dim(item.name)} ${time}`);
        } else if (item.state === "failed") {
          out.push(`${pad(item.depth)}${red(CROSS)} ${red(item.name)} ${time}`);
          failures.push({ file: file.file, title: [...stack.slice(0, item.depth - 1).map((x) => x.name), item.name].join(" › "), error: item.errors[0] });
        } else {
          out.push(`${pad(item.depth)}${yellow(SKIP)} ${yellow(`skipped ${item.name}`)}`);
        }
      }

      // The file failed without any test result (e.g. an import error)
      if (file.failed && !file.items.some((i) => i.kind === "test" && i.state === "failed")) {
        const error = file.moduleErrors[0];
        failures.push({ file: file.file, title: "Test suite failed to run", error });
        out.push(`${pad(1)}${red("Test suite failed to run")}`);
      }
    }

    // ---- failure details ----
    if (failures.length) {
      out.push("");
      out.push(bold(red("Failures")));

      for (const failure of failures) {
        out.push("");
        out.push(red(`● ${failure.title}`));
        out.push(dim(`  ${failure.file}`));
        out.push("");
        out.push(
          shortError(failure.error)
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n")
        );
      }
    }

    // ---- totals ----
    const tests = files.flatMap((f) => f.items.filter((i) => i.kind === "test"));
    const count = (state) => tests.filter((t) => t.state === state).length;
    const failedTests = count("failed");
    const passedTests = count("passed");
    const skippedTests = count("skipped");
    const failedFiles = files.filter((f) => f.failed).length;
    const passedFiles = files.length - failedFiles;

    const parts = (failed, passed, skipped, total) =>
      [
        failed ? red(bold(`${failed} failed`)) : null,
        skipped ? yellow(bold(`${skipped} skipped`)) : null,
        passed ? green(bold(`${passed} passed`)) : null,
        `${total} total`
      ]
        .filter(Boolean)
        .join(", ");

    out.push("");
    out.push(`${bold("Test Suites:")} ${parts(failedFiles, passedFiles, 0, files.length)}`);
    out.push(`${bold("Tests:")}       ${parts(failedTests, passedTests, skippedTests, tests.length)}`);
    out.push(`${bold("Time:")}        ${((Date.now() - this.start) / 1000).toFixed(3)} s`);
    out.push("");

    process.stdout.write(out.join("\n") + "\n");
  }
}
