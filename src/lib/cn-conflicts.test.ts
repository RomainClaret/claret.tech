import { describe, it, expect, afterEach } from "vitest";
import { globSync, readFileSync } from "node:fs";
import ts from "typescript";
import { twMerge } from "tailwind-merge";
import { cn } from "./utils";
import { onConflict, reportConflicts } from "./cn-conflicts";

describe("reportConflicts", () => {
  const reports: string[] = [];
  let restore = () => {};
  const capture = () => {
    restore = onConflict((message) => reports.push(message));
  };
  afterEach(() => {
    restore();
    reports.splice(0);
  });

  it("reports a class that a later one overrides", () => {
    capture();

    reportConflicts("rounded px-2 p-4");

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(
      /^\[cn-conflict\] px-2 overridden by a later class in "rounded px-2 p-4"/,
    );
  });

  it("leaves a later class that refines an earlier one", () => {
    capture();

    // p-4 then px-2: the stylesheet defines px-* after p-*, so both apply
    // as written.
    reportConflicts("p-4 px-2");

    expect(reports).toEqual([]);
  });

  it("leaves repeated classes, and the site's own ones", () => {
    capture();

    reportConflicts("p-2 accent-text p-2 section-title-gradient");

    expect(reports).toEqual([]);
  });

  it("hears from cn() outside production", () => {
    capture();

    cn("h-9", "text-sm", "h-11");

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(/^\[cn-conflict\] h-9 overridden/);
  });
});

/**
 * Every cn() call in the source, read as a syntax tree. No two classes it
 * writes may override each other when they can apply together: the rule
 * reportConflicts applies at run time, here on every branch, not only on
 * those a test renders. Classes that come from props are left to
 * reportConflicts.
 */

/** A condition a class depends on: `expr`, or `expr === value`. */
type Guard = { expr: string; value?: string; negated: boolean };
/** Classes an argument can add, and the conditions they need. */
type Alternative = { classes: string[]; guards: Guard[] };
/** What one argument adds: one of its alternatives. */
type Slot = Alternative[];

const words = (text: string) => text.split(/\s+/).filter(Boolean);

function unwrap(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function guardsOf(node: ts.Expression, negated = false): Guard[] {
  node = unwrap(node);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return guardsOf(node.operand, !negated);
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (!negated && operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [...guardsOf(node.left), ...guardsOf(node.right)];
    }
    const right = unwrap(node.right);
    if (
      (operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
      (ts.isStringLiteral(right) || ts.isNumericLiteral(right))
    ) {
      return [
        {
          expr: node.left.getText(),
          value: right.text,
          negated:
            negated !==
            (operator === ts.SyntaxKind.ExclamationEqualsEqualsToken),
        },
      ];
    }
  }
  return [{ expr: node.getText(), negated }];
}

/** Two conditions that cannot both hold, such as `a` and `!a`. */
function exclusive(a: Guard, b: Guard) {
  if (a.expr !== b.expr) return false;
  if (a.value === undefined || b.value === undefined) {
    return a.value === b.value && a.negated !== b.negated;
  }
  if (a.value === b.value) return a.negated !== b.negated;
  return !a.negated && !b.negated;
}

const together = (a: Alternative, b: Alternative) =>
  !a.guards.some((x) => b.guards.some((y) => exclusive(x, y)));

/** The written classes of a template, without those a `${}` touches. */
function templateClasses(node: ts.TemplateExpression) {
  const parts = [
    node.head.text,
    ...node.templateSpans.map((span) => span.literal.text),
  ];
  return parts.flatMap((text, i) => {
    const tokens = text.split(/\s+/);
    return tokens.filter((token, k) => {
      if (!token) return false;
      if (k === 0 && i > 0) return false;
      if (k === tokens.length - 1 && i < parts.length - 1) return false;
      return true;
    });
  });
}

const withGuards = (alternatives: Alternative[], guards: Guard[]) =>
  alternatives.map((a) => ({ ...a, guards: [...guards, ...a.guards] }));

function slots(node: ts.Expression): Slot[] {
  node = unwrap(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [[{ classes: words(node.text), guards: [] }]];
  }
  if (ts.isTemplateExpression(node)) {
    return [[{ classes: templateClasses(node), guards: [] }]];
  }
  if (ts.isConditionalExpression(node)) {
    return [
      [
        ...withGuards(alternatives(node.whenTrue), guardsOf(node.condition)),
        ...withGuards(
          alternatives(node.whenFalse),
          guardsOf(node.condition, true),
        ),
      ],
    ];
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [
        [
          { classes: [], guards: [] },
          ...withGuards(alternatives(node.right), guardsOf(node.left)),
        ],
      ];
    }
    if (
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [[...alternatives(node.left), ...alternatives(node.right)]];
    }
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.flatMap((element) => slots(element));
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.flatMap((property): Slot[] => {
      if (
        !ts.isPropertyAssignment(property) ||
        !(ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))
      ) {
        return [];
      }
      return [
        [
          { classes: [], guards: [] },
          {
            classes: words(property.name.text),
            guards: guardsOf(property.initializer),
          },
        ],
      ];
    });
  }
  // A prop, a variable, a call: reportConflicts' part.
  return [[{ classes: [], guards: [] }]];
}

/** Every combination of what `node` can add, as one argument. */
function alternatives(node: ts.Expression): Alternative[] {
  let combinations: Alternative[] = [{ classes: [], guards: [] }];
  for (const slot of slots(node)) {
    combinations = combinations.flatMap((before) =>
      slot.map((alternative) => ({
        classes: [...before.classes, ...alternative.classes],
        guards: [...before.guards, ...alternative.guards],
      })),
    );
  }
  return combinations;
}

/** tailwind-merge would drop `earlier` for `later`. */
const overrides = (earlier: string, later: string) =>
  earlier !== later && twMerge(`${earlier} ${later}`) !== `${earlier} ${later}`;

/** "file:line: earlier | later" for each conflict in each cn() call. */
function scan() {
  const found: string[] = [];
  let calls = 0;
  const files = globSync("src/**/*.{ts,tsx}").filter(
    (file) => !/\.(test|spec)\.tsx?$|^src\/test\/|node_modules/.test(file),
  );
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "cn"
      ) {
        calls++;
        const line =
          source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const pairs = new Set<string>();
        const check = (earlier: string[], later: string[]) => {
          for (const a of earlier) {
            for (const b of later) {
              if (overrides(a, b)) pairs.add(`${a} | ${b}`);
            }
          }
        };
        const argumentSlots = node.arguments.flatMap((arg) => slots(arg));
        argumentSlots.forEach((slot, i) => {
          for (const alternative of slot) {
            alternative.classes.forEach((a, k) =>
              check([a], alternative.classes.slice(k + 1)),
            );
            for (const later of argumentSlots.slice(i + 1)) {
              for (const other of later) {
                if (together(alternative, other)) {
                  check(alternative.classes, other.classes);
                }
              }
            }
          }
        });
        for (const pair of pairs) found.push(`${file}:${line}: ${pair}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { found, calls };
}

describe("cn() calls in the source", () => {
  it("write no classes that override each other", () => {
    const { found, calls } = scan();

    // The scan reads the calls, or it proves nothing.
    expect(calls).toBeGreaterThan(100);
    expect(found).toEqual([]);
  });
});
