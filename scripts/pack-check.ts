import { mkdtemp, writeFile, readFile, readdir, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { build } from "vite";
const directory = await mkdtemp(join(tmpdir(), "vibei18n-consumer-"));
const repository = process.cwd();
try {
  const packed = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", directory], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  )[0] as { filename: string; size: number; unpackedSize: number };
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: "external-i18n-consumer",
      private: true,
      type: "module",
      dependencies: {
        "@usevibejs/i18n": `file:${join(directory, packed.filename)}`,
        "@usevibejs/ui": "0.1.0",
      },
    }),
  );
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: directory,
    stdio: "pipe",
  });
  await writeFile(
    join(directory, "consumer.mjs"),
    "import {createI18n} from '@usevibejs/i18n'; import {createCore} from '@usevibejs/i18n/core'; import {validateCatalog} from '@usevibejs/i18n/tooling'; import {localizePath} from '@usevibejs/i18n/router'; const i=createI18n({locale:'en',messages:{en:{hello:'Hello {name}'},tr:{hello:'Merhaba {name}'}}}); await i.ready; if(i.t('hello',{name:'Alex'})!=='Hello Alex')throw Error('consumer translation'); await i.setLocale('tr'); if(i.t('hello',{name:'Alex'})!=='Merhaba Alex')throw Error('consumer switching'); if(createCore({locale:'en',messages:{en:{x:'X'}}}).t('x')!=='X')throw Error('core'); if(validateCatalog({x:'{n}'},{x:'{wrong}'}).length!==2)throw Error('tooling'); if(localizePath('/en/app?q=1#h','tr',['en','tr'])!=='/tr/app?q=1#h')throw Error('router'); i.dispose();",
  );
  execFileSync(process.execPath, ["consumer.mjs"], { cwd: directory, stdio: "pipe" });
  await writeFile(
    join(directory, "types.ts"),
    "import {createI18n} from '@usevibejs/i18n'; const i=createI18n({locale:'en',messages:{en:{hello:'Hello {name}',save:'Save'}}}); i.t('hello',{name:'Alex'}); i.t('save');\n// @ts-expect-error Unknown key\ni.t('missing');\n// @ts-expect-error Missing placeholder\ni.t('hello', {wrong:'Alex'});\n",
  );
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2023",
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      include: ["*.ts"],
    }),
  );
  execFileSync(resolve("node_modules/.bin/tsc"), ["-p", directory], {
    cwd: repository,
    stdio: "pipe",
  });
  const catalogDir = join(directory, "locales");
  await mkdir(catalogDir);
  await writeFile(join(catalogDir, "en.json"), '{"hello":"Hello {name}"}');
  await writeFile(
    join(directory, "vibei18n.config.json"),
    JSON.stringify({
      sourceLocale: "en",
      resources: [{ locale: "en", file: "locales/en.json" }],
      output: "generated.d.ts",
    }),
  );
  const cli = join(directory, "node_modules/@usevibejs/i18n/dist/cli.mjs");
  const checkOutput = execFileSync(process.execPath, [cli, "check", "--json"], {
    cwd: directory,
    encoding: "utf8",
  });
  if (!JSON.parse(checkOutput).ok) throw new Error("Packed CLI did not validate catalogs.");
  execFileSync(process.execPath, [cli, "generate"], { cwd: directory, stdio: "pipe" });
  await writeFile(
    join(directory, "generated-consumer.ts"),
    "import {useI18n} from '@usevibejs/i18n'; const {t}=useI18n(); t('hello',{name:'Alex'});\n// @ts-expect-error Generated schemas reject unknown keys\nt('unknown');\n// @ts-expect-error Generated schemas reject wrong parameter names\nt('hello',{wrong:'Alex'});\n",
  );
  execFileSync(resolve("node_modules/.bin/tsc"), ["-p", directory], {
    cwd: repository,
    stdio: "pipe",
  });
  await writeFile(
    join(directory, "main.ts"),
    "import {createI18n} from '@usevibejs/i18n'; const i=createI18n({locale:'en',messages:{en:{hello:'Hello'}}}); document.body.textContent=i.t('hello');",
  );
  await writeFile(
    join(directory, "index.html"),
    '<div></div><script type="module" src="/main.ts"></script>',
  );
  const modules: string[] = [];
  await build({
    configFile: false,
    root: directory,
    logLevel: "warn",
    plugins: [
      {
        name: "inspect",
        generateBundle(_options, bundle) {
          for (const item of Object.values(bundle))
            if (item.type === "chunk") modules.push(...Object.keys(item.modules));
        },
      },
    ],
    build: { target: "es2023" },
  });
  for (const name of [
    "oxc-parser",
    "jsonc-parser",
    "/tooling/",
    "node:",
    "/vite/",
    "@usevibejs/compiler",
  ])
    if (modules.some((id) => id.includes(name)))
      throw new Error(`Browser runtime includes forbidden tooling: ${name}`);
  const files = await readdir(join(directory, "dist/assets"));
  const javascript = Buffer.concat(
    await Promise.all(
      files
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFile(join(directory, "dist/assets", file))),
    ),
  );
  await writeFile(
    join(directory, "main.ts"),
    "import {directionOf} from '@usevibejs/i18n'; document.body.textContent=directionOf('ar');",
  );
  const helperModules: string[] = [];
  await build({
    configFile: false,
    root: directory,
    logLevel: "warn",
    plugins: [
      {
        name: "inspect-helper",
        generateBundle(_options, bundle) {
          for (const item of Object.values(bundle))
            if (item.type === "chunk") helperModules.push(...Object.keys(item.modules));
        },
      },
    ],
    build: { target: "es2023" },
  });
  if (helperModules.some((id) => id.includes("intl-messageformat") || id.includes("@usevibejs/ui")))
    throw new Error("Pure locale helpers retain unrelated runtime modules.");
  const helperFiles = await readdir(join(directory, "dist/assets"));
  const helper = Buffer.concat(
    await Promise.all(
      helperFiles
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFile(join(directory, "dist/assets", file))),
    ),
  );
  const result = {
    packageBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    browserRuntimeBytes: javascript.length,
    browserRuntimeGzipBytes: gzipSync(javascript).length,
    runtimeModules: modules.length,
    pureDirectionHelperGzipBytes: gzipSync(helper).length,
    consumer: "Node imports, TypeScript, CLI, browser build and tooling isolation passed",
  };
  await mkdir("reports", { recursive: true });
  await writeFile("reports/package.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (error && typeof error === "object" && "stderr" in error) console.error(String(error.stderr));
  if (error && typeof error === "object" && "stdout" in error) console.error(String(error.stdout));
  throw error;
} finally {
  await rm(directory, { recursive: true, force: true });
}
