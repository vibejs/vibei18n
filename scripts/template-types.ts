import { writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const file = "examples/showcase/src/InvalidTypes.vibe";
try {
  await writeFile(
    file,
    `<script setup lang="ts">\nimport {useI18n} from '../../../src/index.ts';\nconst {t}=useI18n();\n</script>\n<template><p>{{t('unknownTranslationKey')}}</p><p>{{t('greeting',{wrong:'Alex'})}}</p><p>{{t('items',{count:'three'})}}</p></template>`,
  );
  let output = "";
  let failed = false;
  try {
    execFileSync(
      resolve("node_modules/.bin/tsc"),
      ["-b", "examples/showcase", "--force", "--runExternalCode"],
      { encoding: "utf8", stdio: "pipe" },
    );
  } catch (error) {
    failed = true;
    if (error && typeof error === "object" && "stdout" in error) output = String(error.stdout);
  }
  if (
    !failed ||
    !output.includes("InvalidTypes.vibe") ||
    !output.includes("unknownTranslationKey") ||
    !output.includes("wrong") ||
    !output.includes("number")
  )
    throw new Error(`Template type rejection failed: ${output}`);
  console.log(
    "Real .vibe type checks reject unknown keys, wrong placeholders and nonnumeric plurals.",
  );
} finally {
  await rm(file, { force: true });
}
