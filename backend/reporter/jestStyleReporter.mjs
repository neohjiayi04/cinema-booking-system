// Jest-style reporter for Node's built-in test runner (node --test).
// Same look as the frontend (Vitest) reporter:
//
//   PASS  tests/admin.test.js
//     Admin features
//       ✓ an admin can change a user role (61 ms)
//
//   Test Suites: 1 passed, 1 total
//   Tests:       9 passed, 9 total
//   Time:        4.318 s
//
// Usage:  node --test --test-reporter=./reporters/jestStyleReporter.mjs

import path from "node:path";
import process from "node:process";
import { inspect } from "node:util";

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
const TICK = process.platform === "win32" ? "√" : "✓";
const CROSS = process.platform === "win32" ? "×" : "✕";
const SKIP = "○";

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (text) => String(text ?? "").replace(ANSI_PATTERN, "");
const toPosix = (p) => String(p).replace(/\\/g, "/");
const pad = (depth) => "  ".repeat(depth);
const fmtMs = (ms) => `${Math.round(Number(ms) || 0)} ms`;

function shortError(error, stderrLines = []) {
  // node:test wraps the real error: details.error.cause is the AssertionError
  const real = error?.cause ?? error;

  // Assertion failures: show "Expected" / "Received" instead of Node's
  // character-by-character colour diff, which is hard to read.
  if (real?.code === "ERR_ASSERTION" && ("actual" in real || "expected" in real)) {
    const headline = stripAnsi(real.message || "Assertion failed").split("\n")[0];
    return [
      headline,
      "",
      `Expected: ${inspect(real.expected, { depth: 4, breakLength: 80 })}`,
      `Received: ${inspect(real.actual, { depth: 4, breakLength: 80 })}`
    ].join("\n");
  }

  const message = stripAnsi(real?.message || String(real ?? "Unknown error"));

  // A test file that crashes while loading (bad import, syntax error) only says
  // "test failed"; the useful text is what the file printed to stderr.
  if (message === "test failed" && stderrLines.length) {
    const useful = stderrLines
      .map((line) => stripAnsi(line).trimEnd())
      .filter((line) => line.trim() && !line.trim().startsWith("at "));
    const errorLine = useful.findIndex((line) => /\bError\b/.test(line));
    return useful.slice(errorLine >= 0 ? errorLine : 0, (errorLine >= 0 ? errorLine : 0) + 4).join("\n");
  }

  const lines = message.split("\n");
  const kept = lines.slice(0, 16);
  if (lines.length > kept.length) kept.push("...");
  return kept.join("\n");
}

// Events arrive children-first (a suite is reported after its tests), each with
// a "nesting" level. Rebuild the tree: when an item arrives, every pending item
// that is nested deeper than it and was reported before it is one of its children.
function buildTree(records) {
  const pending = [];

  for (const record of records) {
    const node = { ...record, children: [] };

    while (pending.length && pending[pending.length - 1].nesting > node.nesting) {
      node.children.unshift(pending.pop());
    }

    pending.push(node);
  }

  return pending;
}

export default async function* jestStyleReporter(source) {
  const start = Date.now();
  const files = new Map(); // file -> records[]
  const stderr = new Map(); // file -> lines the test file printed to stderr

  for await (const event of source) {
    if (event.type === "test:stderr" && event.data.file) {
      const key = toPosix(path.relative(process.cwd(), event.data.file));
      if (!stderr.has(key)) stderr.set(key, []);
      stderr.get(key).push(...String(event.data.message).split("\n"));
      continue;
    }

    if (event.type !== "test:pass" && event.type !== "test:fail") continue;

    const data = event.data;
    const file = data.file ? toPosix(path.relative(process.cwd(), data.file)) : "(tests)";

    if (!files.has(file)) files.set(file, []);

    files.get(file).push({
      name: data.name,
      nesting: data.nesting ?? 0,
      isSuite: data.details?.type === "suite",
      state: event.type === "test:fail" ? "failed" : data.skip || data.todo ? "skipped" : "passed",
      duration: data.details?.duration_ms ?? 0,
      error: data.details?.error
    });
  }

  const out = [];
  const failures = [];
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  let failedFiles = 0;

  for (const file of [...files.keys()].sort()) {
    const roots = buildTree(files.get(file));
    const lines = [];
    let fileFailed = false;

    const walk = (nodes, depth, trail) => {
      for (const node of nodes) {
        if (node.isSuite || node.children.length) {
          // A suite that itself failed (e.g. a hook error) with no failing child
          if (node.state === "failed" && !node.children.some((child) => child.state === "failed")) {
            fileFailed = true;
            failedTests += 1;
            failures.push({ file, title: [...trail, node.name].join(" › "), error: node.error });
          }

          lines.push(`${pad(depth)}${bold(node.name)}`);
          walk(node.children, depth + 1, [...trail, node.name]);
          continue;
        }

        const time = dim(`(${fmtMs(node.duration)})`);

        if (node.state === "passed") {
          passedTests += 1;
          lines.push(`${pad(depth)}${green(TICK)} ${dim(node.name)} ${time}`);
        } else if (node.state === "failed") {
          failedTests += 1;
          fileFailed = true;
          lines.push(`${pad(depth)}${red(CROSS)} ${red(node.name)} ${time}`);
          failures.push({ file, title: [...trail, node.name].join(" › "), error: node.error });
        } else {
          skippedTests += 1;
          lines.push(`${pad(depth)}${yellow(SKIP)} ${yellow(`skipped ${node.name}`)}`);
        }
      }
    };

    walk(roots, 1, []);

    if (fileFailed) failedFiles += 1;

    out.push("");
    out.push(
      `${fileFailed ? failBadge() : passBadge()} ${dim(path.posix.dirname(file) + "/")}${bold(path.posix.basename(file))}`
    );
    out.push(...lines);
  }

  if (failures.length) {
    out.push("");
    out.push(bold(red("Failures")));

    for (const failure of failures) {
      out.push("");
      out.push(red(`● ${failure.title}`));
      out.push(dim(`  ${failure.file}`));
      out.push("");
      out.push(
        shortError(failure.error, stderr.get(failure.file))
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")
      );
    }
  }

  const totalTests = passedTests + failedTests + skippedTests;
  const totalFiles = files.size;
  const passedFiles = totalFiles - failedFiles;

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
  out.push(`${bold("Test Suites:")} ${parts(failedFiles, passedFiles, 0, totalFiles)}`);
  out.push(`${bold("Tests:")}       ${parts(failedTests, passedTests, skippedTests, totalTests)}`);
  out.push(`${bold("Time:")}        ${((Date.now() - start) / 1000).toFixed(3)} s`);
  out.push("");

  yield out.join("\n") + "\n";

  if (failedTests > 0 || failedFiles > 0) process.exitCode = 1;
}