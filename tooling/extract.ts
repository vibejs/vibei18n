import { parseSync } from "oxc-parser";
import { parse, NodeTypes } from "@usevibejs/compiler";
import type { TemplateChildNode, SimpleExpressionNode } from "@usevibejs/compiler";
export interface Reference {
  key?: string;
  dynamic: boolean;
  file: string;
  line: number;
  column: number;
  namespace?: string;
  description?: string;
}
export function extractMessages(
  source: string,
  file: string,
  options: { callees?: readonly string[]; namespace?: string } = {},
): Reference[] {
  const references: Reference[] = [];
  const callees = new Set(options.callees ?? ["t", "dynamic"]);
  function expression(code: string, offset: number, wrapped = false): void {
    const prefix = wrapped ? "(" : "";
    const result = parseSync("extract.ts", `${prefix}${code}${wrapped ? ")" : ""}`);
    if (result.errors.length) throw new SyntaxError(`${file}: ${result.errors[0].message}`);
    function visit(value: unknown): void {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      const node = value as Record<string, unknown>;
      if (node.type === "CallExpression") {
        const callee = node.callee as Record<string, unknown>;
        const property = callee.property as Record<string, unknown> | undefined;
        const name =
          callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" && callee.computed === false
              ? property?.name
              : undefined;
        if (typeof name === "string" && callees.has(name)) {
          const args = node.arguments as Record<string, unknown>[];
          const first = args[0];
          const key =
            first?.type === "Literal" && typeof first.value === "string"
              ? first.value
              : first?.type === "StringLiteral"
                ? (first.value as string)
                : undefined;
          const at = offset + Number(node.start) - prefix.length;
          const before = source.slice(0, at).split("\n");
          const comment = [...result.comments]
            .reverse()
            .find(
              (item) =>
                item.end <= Number(node.start) &&
                code.slice(item.end, Number(node.start)).trim() === "",
            );
          references.push({
            key,
            dynamic: key === undefined,
            file,
            line: before.length,
            column: before.at(-1)!.length + 1,
            namespace:
              options.namespace ??
              (key?.includes(":") ? key.slice(0, key.indexOf(":")) : undefined),
            description: comment?.value.trim().replace(/^i18n:\s*/, ""),
          });
        }
      }
      for (const [name, child] of Object.entries(node))
        if (!["loc", "span", "parent"].includes(name)) visit(child);
    }
    visit(result.program);
  }
  if (!file.endsWith(".vibe")) {
    expression(source, 0);
    return references;
  }
  const { descriptor, diagnostics } = parse(source, { filename: file });
  if (diagnostics.length) throw new SyntaxError(`${file}: ${diagnostics[0].message}`);
  if (descriptor.scriptSetup)
    expression(descriptor.scriptSetup.content, descriptor.scriptSetup.loc.start.offset);
  const expr = (node: SimpleExpressionNode) => {
    if (!node.isStatic) expression(node.content, node.loc.start.offset, true);
  };
  const walk = (children: readonly TemplateChildNode[]) => {
    for (const node of children) {
      if (node.type === NodeTypes.INTERPOLATION) expr(node.content);
      if (node.type === NodeTypes.ELEMENT) {
        for (const prop of node.props)
          if (
            prop.type === NodeTypes.DIRECTIVE &&
            prop.exp &&
            prop.name !== "for" &&
            prop.name !== "slot"
          ) {
            if (prop.name === "on") expression(prop.exp.content, prop.exp.loc.start.offset);
            else expr(prop.exp);
          }
        walk(node.children);
      }
    }
  };
  if (descriptor.template) walk(descriptor.template.ast.children);
  return references;
}
