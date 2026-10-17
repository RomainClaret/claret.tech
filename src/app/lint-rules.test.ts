import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

/**
 * A violation planted for each plugin the lint config brings in. Three of
 * them (react, jsx-a11y, import) leave ESLint 10 out of their peer range and
 * run on it through eslint-config-next's compatibility layer. A rule that
 * loads but stops reporting would pass `npm run lint` without a word; here
 * it fails.
 */
const component = `"use client";
import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export function Probe({ items, flag }: { items: string[]; flag: boolean }) {
  const [count, setCount] = useState(0);
  if (flag) {
    useEffect(() => {});
  }
  useEffect(() => {
    setCount(count + 1);
  }, []);
  const unused = 1;
  const anything: any = null;
  ReactDOM.render(<div />, document.body);
  return (
    <div>
      {items.map((item) => <span>{item}</span>)}
      <img src="/x.png" />
      <div aria-foo="x" />
      <p>don't</p>
      {anything}
    </div>
  );
}
`;

async function lint(code: string, filePath: string) {
  const [result] = await new ESLint({ cwd: process.cwd() }).lintText(code, {
    filePath,
  });
  return result.messages;
}

describe("the lint config", () => {
  it("reports a planted violation from each plugin", async () => {
    const messages = await lint(component, "src/components/lint-probe.tsx");

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toEqual(
      expect.arrayContaining([
        "@next/next/no-img-element",
        "@typescript-eslint/no-explicit-any",
        "@typescript-eslint/no-unused-vars",
        "jsx-a11y/alt-text",
        "jsx-a11y/aria-props",
        "react-hooks/exhaustive-deps",
        "react-hooks/rules-of-hooks",
        // One of the React Compiler's rules.
        "react-hooks/set-state-in-effect",
        "react/jsx-key",
        // Detects the React version, which needs the file's name.
        "react/no-deprecated",
        "react/no-unescaped-entities",
      ]),
    );
  });

  it("reports an anonymous default export", async () => {
    const messages = await lint(
      "export default () => 1;\n",
      "src/lib/lint-probe.ts",
    );

    expect(messages.map((message) => message.ruleId)).toEqual([
      "import/no-anonymous-default-export",
    ]);
  });
});
