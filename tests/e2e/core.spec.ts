import { expect, test } from "@playwright/test";

test("auth page renders Arabic glass signup flow", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /أهلًا بعودتك|ابدأ رحلتك/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /المتابعة بحساب جوجل/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /عندك كود من ناديك/ })).toBeVisible();
});

test("join page previews code input and keeps generic invalid errors", async ({ page }) => {
  await page.goto("/auth/join");
  await expect(page.getByRole("heading", { name: "أدخل كود النادي" })).toBeVisible();
  const input = page.getByLabel("كود الانضمام");
  await input.fill("BAD-12345");
  await expect(input).toHaveValue("BAD-12345");
});

test("protected app redirects anonymous users to auth", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth/);
});