import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/auth");
  await page.evaluate(() => localStorage.clear());
});

test("auth page renders the staged signup journey without default answers", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "جاهز نبني حسابك الرياضي؟" })).toBeVisible();
  await page.getByRole("button", { name: "ابدأ الآن" }).click();
  await expect(page.getByRole("heading", { name: "طريقة إنشاء الحساب" })).toBeVisible();
  await expect(page.getByRole("button", { name: /التسجيل باستخدام Google/ })).toBeVisible();
  await page.getByRole("button", { name: "التسجيل بالبريد وكلمة مرور" }).click();
  await expect(page.getByRole("heading", { name: "بياناتك الأساسية" })).toBeVisible();
  await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /معك كود نادي فقط/ })).toBeVisible();
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

test("admin area redirects anonymous users to dedicated admin login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "دخول الإدارة" })).toBeVisible();
  await expect(page.getByRole("button", { name: "دخول" })).toBeVisible();
});
