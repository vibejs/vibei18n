import { test, expect } from "@playwright/test";
async function choose(page: import("@playwright/test").Page, name: string) {
  const input = page.getByRole("combobox");
  await input.fill(name);
  await page.getByRole("option").filter({ hasText: name }).click();
}
test("English initial render, lazy locale switching and editing/table state preservation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/dashboard?sort=asc#details");
  await expect(page.locator("h1")).toHaveText("Workspace overview");
  await page.getByTestId("profile-name").first().fill("Robin");
  await page.getByRole("checkbox", { name: "Aiko Tanaka" }).check();
  await choose(page, "Türkçe");
  await expect(page.locator("h1")).toHaveText("Çalışma alanına genel bakış");
  await expect(page).toHaveURL("/tr/dashboard?sort=asc#details");
  await expect(page.getByTestId("profile-name").first()).toHaveValue("Robin");
  await expect(page.getByRole("checkbox", { name: "Aiko Tanaka" })).toBeChecked();
  await expect(page.getByTestId("selection-count")).toContainText("1");
  await expect(page.getByTestId("revenue")).toContainText("48.295,50");
  await choose(page, "Deutsch");
  await expect(page.locator("h1")).toHaveText("Arbeitsbereich im Überblick");
  await choose(page, "日本語");
  await expect(page.locator("h1")).toHaveText("ワークスペースの概要");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByTestId("fallback")).toContainText("English fallback");
  expect(errors).toEqual([]);
});
test("native-language options support search and keyboard selection", async ({ page }) => {
  await page.goto("/en/dashboard");
  const input = page.getByRole("combobox");
  await input.fill("Français");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator("h1")).toHaveText("Vue d’ensemble");
});
test("saved preference is restored on an unprefixed entry and route wins over storage", async ({
  page,
}) => {
  await page.goto("/en/dashboard");
  await choose(page, "Türkçe");
  await expect(page.locator("h1")).toHaveText("Çalışma alanına genel bakış");
  await page.goto("/");
  await expect(page).toHaveURL("/tr/dashboard");
  await expect(page.locator("h1")).toHaveText("Çalışma alanına genel bakış");
  await page.goto("/en/dashboard");
  await expect(page.locator("h1")).toHaveText("Workspace overview");
});
test("form errors translate without resetting dirty values; pagination survives language change", async ({
  page,
}) => {
  await page.goto("/en/dashboard");
  const name = page.getByTestId("profile-name").first();
  await name.fill("");
  await name.blur();
  await expect(page.getByRole("alert")).toHaveText("Name is required");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".page-number")).toHaveText("2 / 2");
  await choose(page, "Türkçe");
  await expect(page.getByRole("alert")).toHaveText("Ad gereklidir");
  await expect(name).toHaveValue("");
  await expect(page.locator(".page-number")).toHaveText("2 / 2");
});
test("nested direction changes, multiple app isolation, cleanup and ICU validation", async ({
  page,
}) => {
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "ICU playground", exact: true }).click();
  const preview = page.getByTestId("nested-preview");
  await expect(preview).toHaveAttribute("dir", "rtl");
  await preview.getByRole("button", { name: "עברית" }).click();
  await expect(preview).toHaveAttribute("lang", "he");
  await expect(page.getByTestId("nested-descendant")).toHaveAttribute("lang", "he");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Unmount preview" }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Mount preview" }).click();
  await expect(preview).toHaveAttribute("lang", "ar");
  await expect(page.getByTestId("independent-app")).toHaveAttribute("lang", "tr");
  await page.getByRole("button", { name: "Switch widget locale" }).click();
  await expect(page.getByTestId("independent-app")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("icu-output")).toHaveText("12 messages for Alex");
  await page.locator("#icu-message").fill("{count, plural, one {Missing other}}");
  await expect(page.getByRole("alert")).toBeVisible();
});
test("dialog stays open while locale changes through another tab", async ({ page, context }) => {
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#invite-email").fill("guest@example.test");
  const other = await context.newPage();
  await other.goto("/en/dashboard");
  await choose(other, "Türkçe");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#invite-email")).toHaveValue("guest@example.test");
  await expect(page.getByRole("dialog")).toContainText("Yeni bir bakış açısına yer açın");
});
test("safe interpolation remains text and documentation search works", async ({ page }) => {
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "ICU playground", exact: true }).click();
  await page.locator("#icu-message").fill("Hello {name}");
  await page.locator("#icu-values").fill('{"name":"<img src=x onerror=alert(1)>"}');
  await expect(page.getByTestId("icu-output")).toHaveText("Hello <img src=x onerror=alert(1)>");
  await expect(page.getByTestId("icu-output").locator("img")).toHaveCount(0);
  await page.getByRole("button", { name: "Documentation", exact: true }).click();
  await page.getByRole("textbox", { name: "Search documentation" }).fill("pseudolocalization");
  await expect(page.locator(".docs-panel h2")).toBeVisible();
});
test("mobile layout and theme render without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/dashboard");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/showcase-mobile.png", fullPage: true });
});
test("desktop dashboard screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/en/dashboard");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({ path: "test-results/showcase-desktop.png", fullPage: true });
});
test("all ten showcase locales render with coherent catalogs", async ({ page }) => {
  await page.goto("/en/dashboard");
  for (const [label, heading] of [
    ["Italiano", "Panoramica dello spazio"],
    ["Português (Brasil)", "Visão geral do espaço"],
    ["Русский", "Обзор рабочего пространства"],
    ["Español", "Resumen del espacio"],
    ["한국어", "작업 공간 개요"],
    ["Français", "Vue d’ensemble"],
    ["Deutsch", "Arbeitsbereich im Überblick"],
    ["Türkçe", "Çalışma alanına genel bakış"],
    ["日本語", "ワークスペースの概要"],
    ["English", "Workspace overview"],
  ]) {
    await choose(page, label);
    await expect(page.locator("h1")).toHaveText(heading);
  }
});
test("a slower locale cannot replace a newer choice", async ({ page }) => {
  let release!: () => void;
  let began!: () => void;
  const started = new Promise<void>((yes) => {
    began = yes;
  });
  const pending = new Promise<void>((yes) => {
    release = yes;
  });
  await page.route("**/locales/fr.json*", async (route) => {
    began();
    await pending;
    await route.continue();
  });
  await page.goto("/en/dashboard");
  await choose(page, "Français");
  await started;
  await expect(page.locator("h1")).toHaveText("Workspace overview");
  await choose(page, "Deutsch");
  await expect(page.locator("h1")).toHaveText("Arbeitsbereich im Überblick");
  release();
  await expect(page).toHaveURL("/de/dashboard");
  await expect(page.locator("h1")).toHaveText("Arbeitsbereich im Überblick");
});
test("catalog load failure has an accessible retry action", async ({ page }) => {
  let fail = true;
  await page.route("**/locales/fr.json*", async (route) => {
    if (fail) {
      fail = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.goto("/en/dashboard");
  await choose(page, "Français");
  await expect(page.getByRole("alert")).toHaveText("Try again");
  await expect(page.locator("h1")).toHaveText("Workspace overview");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("h1")).toHaveText("Vue d’ensemble");
});
test("light/dark mode and pseudolocalization remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "ICU playground", exact: true }).click();
  await page.getByRole("checkbox", { name: "RTL preview", exact: true }).check();
  await expect(page.locator(".stress-frame")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".pseudo-button")).toContainText("[");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("unmounting one actual application leaves the other application reactive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "Unmount widget", exact: true }).click();
  await expect(page.getByTestId("independent-app")).toHaveCount(0);
  await choose(page, "Türkçe");
  await expect(page.locator("h1")).toHaveText("Çalışma alanına genel bakış");
  expect(errors).toEqual([]);
});
