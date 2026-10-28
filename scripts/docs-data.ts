import { readFile, writeFile } from "node:fs/promises";
const files = [
  "getting-started",
  "core",
  "formatting",
  "type-safety",
  "advanced",
  "tooling",
  "security-performance",
  "ecosystem",
  "reference",
  "research",
];
const pages = await Promise.all(
  files.map(async (id) => {
    const text = await readFile(`docs/${id}.md`, "utf8");
    const blocks: { kind: "heading" | "text" | "code"; text: string }[] = [];
    let code = false,
      buffer: string[] = [];
    const flush = () => {
      if (buffer.length) {
        blocks.push({ kind: code ? "code" : "text", text: buffer.join("\n") });
        buffer = [];
      }
    };
    for (const line of text.split("\n")) {
      if (line.startsWith("```")) {
        flush();
        code = !code;
      } else if (!code && line.startsWith("#")) {
        flush();
        blocks.push({ kind: "heading", text: line.replace(/^#+\s*/, "") });
      } else if (!code && !line) {
        flush();
      } else buffer.push(line);
    }
    flush();
    return { id, title: blocks[0].text, blocks: blocks.slice(1) };
  }),
);
await writeFile("examples/showcase/src/docs.gen.json", JSON.stringify(pages, null, 2) + "\n");
