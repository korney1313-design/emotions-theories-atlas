import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "artifacts/qa/leontiev-stage-b";
fs.mkdirSync(qa, { recursive: true });
test("nested activity scene changes operation objects and relations when conditions change", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?atlas=leontiev");
  await page.waitForFunction(() => window.atlas?.data?.id === "leontiev");
  await page.locator("#search").fill("Деятельность");
  await page.locator('[data-result="activity"]').click();
  await page.locator("#open-lab").click();
  await expect(page.locator("#lab-title")).toHaveText(
    "Строение деятельности: условия и операции",
  );
  await expect(page.locator('[data-scene-frame="learning"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(
    page.locator('[data-scene-frame="recognition"]'),
  ).toHaveAttribute("data-active", "false");
  await expect(page.locator('[data-object="paper-tools"]')).toBeVisible();
  await expect(page.locator('[data-role="operation"]')).toHaveCount(2);
  await expect(
    page.locator('[data-relation="affords"][data-from="paper-tools"]'),
  ).toHaveCount(2);
  const goal = await page.locator('[data-object="goal"]').textContent();
  await page.screenshot({ path: `${qa}/before-paper.png` });
  await page.locator("#lab-conditions").selectOption("digital");
  await expect(page.locator('[data-object="paper-tools"]')).toHaveCount(0);
  await expect(page.locator('[data-object="paper-cards"]')).toHaveCount(0);
  await expect(page.locator('[data-object="digital-tools"]')).toBeVisible();
  await expect(page.locator('[data-role="operation"]')).toHaveCount(3);
  await expect(
    page.locator('[data-relation="affords"][data-from="digital-tools"]'),
  ).toHaveCount(3);
  await expect(
    page.locator('[data-relation="realizes"][data-to="prepare-explanation"]'),
  ).toHaveCount(3);
  await expect(page.locator('[data-object="goal"]')).toHaveText(goal);
  await expect(page.locator('[data-scene-frame="learning"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.locator(".mechanism-explanation")).toContainText(
    "Состав способов: 2 → 3",
  );
  await page.screenshot({ path: `${qa}/after-digital.png` });
  await page.locator("#lab-motiveContext").selectOption("recognition");
  await expect(
    page.locator('[data-scene-frame="recognition"]'),
  ).toHaveAttribute("data-active", "true");
  await expect(page.locator('[data-scene-frame="learning"]')).toHaveAttribute(
    "data-active",
    "false",
  );
  await expect(
    page.locator(
      '[data-scene-frame="recognition"] [data-object="prepare-explanation"]',
    ),
  ).toBeVisible();
  await expect(page.locator('[data-role="operation"]')).toHaveCount(3);
  await expect(page.locator('[data-object="goal"]')).toHaveText(goal);
  await page.screenshot({ path: `${qa}/motive-switch.png` });
  await page.locator("#lab-evidence summary").click();
  await expect(page.locator("#lab-claim-l-ways-example")).toContainText(
    "Учебная интерпретация",
  );
  await expect(page.locator("#lab-claim-l-structure")).toContainText("с. 56");
  await page.locator("#lab-reset").click();
  await expect(page.locator('[data-scene-frame="learning"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(page.locator('[data-object="paper-tools"]')).toBeVisible();
  await expect(page.locator('[data-role="operation"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});
