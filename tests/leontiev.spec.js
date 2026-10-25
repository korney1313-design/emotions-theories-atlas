import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "artifacts/qa/leontiev";
fs.mkdirSync(qa, { recursive: true });
test("four theory areas and three teacher-led models retain graph context", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?atlas=leontiev");
  await page.waitForFunction(() => window.atlas?.data?.id === "leontiev");
  await expect(page.locator("#status")).toHaveText("21 понятий · 27 отношений");
  await expect(page.locator("#legend .legend-item")).toHaveCount(4);
  await expect(page.locator(".teacher-guide")).toContainText("7–10 минут");
  await page.screenshot({ path: `${qa}/overview.png` });
  await page.locator("#search").fill("Деятельность");
  await page.locator('[data-result="activity"]').click();
  await expect(page.locator("#open-lab")).toBeVisible();
  await page.locator("#open-lab").click();
  await expect(page.locator("#lab-results")).toContainText(
    "Операция ↔ условия",
  );
  const original = await page.locator('[data-output="motive"]').textContent();
  await page.locator("#lab-conditions").selectOption("digital");
  await expect(page.locator('[data-output="operation"]')).toHaveText(
    "Работа в цифровой среде",
  );
  await expect(page.locator('[data-output="motive"]')).toHaveText(original);
  await page.screenshot({ path: `${qa}/levels.png` });
  await page.locator('[data-model="leontiev-sense"]').click();
  const meaning = await page.locator('[data-output="meaning"]').textContent();
  await page.locator("#lab-motiveContext").selectOption("recognition");
  await expect(page.locator('[data-output="sense"]')).toHaveText(
    "Способ получить признание",
  );
  await expect(page.locator('[data-output="meaning"]')).toHaveText(meaning);
  await page.screenshot({ path: `${qa}/sense.png` });
  await page.locator('[data-model="leontiev-emotion"]').click();
  await expect(page.locator('[data-output="signal"]')).toContainText(
    "не задаёт эмоцию",
  );
  await page.locator("#lab-motiveContext").selectOption("recognition");
  await page.locator("#lab-trace summary").click();
  await expect(page.locator("#lab-trace-content")).toContainText(
    "учебное правило",
  );
  await page.locator("#lab-evidence summary").click();
  await expect(page.locator("#lab-evidence")).toContainText("с. 103");
  await expect(page.locator("#lab-evidence")).toContainText("1971");
  await page.locator("#lab-claim-l-emotion").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${qa}/evidence.png` });
  await page.locator("#model-laboratory").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: `${qa}/emotion.png` });
  await page.keyboard.press("Escape");
  await expect(page.locator("#model-laboratory")).not.toBeVisible();
  await expect(page.locator("#card h2")).toHaveText("Деятельность");
  await page.locator("#search").fill("Личностный смысл");
  await page.locator('[data-result="sense"]').click();
  await expect(page.locator("#card h2")).toHaveText("Личностный смысл");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${qa}/concept-sense.png` });
  await page.locator("#open-lab").click();
  await expect(page.locator("#lab-title")).toHaveText(
    "Значение и личностный смысл",
  );
  await page.keyboard.press("Escape");
  await page.locator("#search").fill("Эмоция");
  await page.locator('[data-result="emotion"]').click();
  await expect(page.locator("#card h2")).toHaveText("Эмоция");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${qa}/concept-emotion.png` });
  await page.locator("#open-lab").click();
  await expect(page.locator("#lab-title")).toHaveText("Мотивы и эмоции");
  expect(errors).toEqual([]);
});
