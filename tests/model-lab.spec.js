import { test, expect } from "@playwright/test";
import fs from "node:fs";
const qa = "artifacts/qa/model-lab/final";
fs.mkdirSync(qa, { recursive: true });
async function choose(page, atlas, label, id) {
  await page.goto(`/?atlas=${atlas}`);
  await page.waitForFunction(() => !!window.atlas);
  await page.locator("#search").fill(label);
  await page.locator(`[data-result="${id}"]`).click();
}
async function lab(page, atlas = "berne", label = "Трансакция", id = "trans") {
  await choose(page, atlas, label, id);
  await page
    .locator(atlas === "emotions" ? "#open-lab-from-model" : "#open-lab")
    .click();
  await expect(page.locator("#model-laboratory")).toBeVisible();
}
const state = (page) =>
  page.evaluate(() => window.atlas.laboratory().getState());
const observed = (page) =>
  page.evaluate(() => window.atlas.laboratory().getObservables());
function errors(page) {
  const all = [];
  page.on("pageerror", (e) => all.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") all.push(m.text());
  });
  return all;
}

test("laboratory transaction vectors, classification, role reversal, reset and graph return", async ({
  page,
}) => {
  const e = errors(page);
  await lab(page);
  await expect(page.locator('[data-output="kind"]')).toHaveText(
    "Дополнительная",
  );
  const circles = await page
    .locator('[data-ego^="left-"] circle')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("cy"))));
  expect(circles).toEqual([85, 205, 325]);
  await page.locator("#lab-responseFrom").selectOption("P");
  await expect(page.locator('[data-output="kind"]')).toHaveText(
    "Пересекающаяся",
  );
  expect((await state(page)).inputs.responseFrom).toBe("P");
  await page.locator("#lab-trace summary").first().click();
  await expect(page.locator("#lab-trace-content")).toContainText(
    "Класс социального уровня",
  );
  await page.locator("#lab-trace summary").first().click();
  await page.locator("#model-laboratory").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: `${qa}/berne-crossed.png` });
  await page.locator('[data-lab-event="swap-roles"]').click();
  await expect(page.locator('[data-vector="social-stimulus"]')).toHaveAttribute(
    "data-sender",
    "right",
  );
  await expect(page.locator('[data-vector="social-response"]')).toHaveAttribute(
    "data-receiver",
    "right",
  );
  await page.locator("#lab-reset").click();
  expect((await state(page)).inputs.initiator).toBe("left");
  expect(
    await page.evaluate(() => window.atlas.laboratory().getTrace().length),
  ).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#model-laboratory")).not.toBeVisible();
  expect(await page.evaluate(() => window.atlas.getState().selected)).toBe(
    "trans",
  );
  await expect(page.locator("#card h2")).toHaveText("Трансакция");
  await page.locator("#expand").click();
  expect(await page.evaluate(() => window.atlas.getState().expanded)).toBe(
    true,
  );
  expect(e).toEqual([]);
});
test("hidden transaction retains simultaneous social and psychological vectors and functional separation", async ({
  page,
}) => {
  await lab(page);
  await page.locator("#lab-hidden").check();
  await page.locator("#lab-psychResponseFrom").selectOption("P");
  await expect(page.locator('[data-output="socialClass"]')).toHaveText(
    "Дополнительная",
  );
  await expect(page.locator('[data-output="psychClass"]')).toHaveText(
    "Пересекающаяся",
  );
  await expect(page.locator("[data-vector]")).toHaveCount(4);
  await expect(
    page.locator('[data-vector="psychological-response"]'),
  ).toHaveAttribute("stroke-dasharray", "8 5");
  await page.screenshot({ path: `${qa}/berne-hidden.png` });
  await page.locator("#lab-functional summary").click();
  const before = (await observed(page)).socialClass;
  await page.locator("#lab-leftFunction").selectOption("controlling");
  expect((await observed(page)).socialClass).toBe(before);
  await expect(page.locator("#lab-functional")).toContainText(
    "не переопределяет структурную гипотезу",
  );
  await page.screenshot({ path: `${qa}/berne-functional.png` });
  await page.locator("#lab-psychStimulusTo").selectOption("__unknown__");
  await expect(page.locator('[data-output="psychClass"]')).toHaveText(
    "Не представлено",
  );
  await expect(page.locator('[data-output="kind"]')).toHaveText(
    "Скрытый уровень · данных недостаточно",
  );
  await expect(page.locator("[data-psych-incomplete]")).toContainText(
    "Класс скрытой трансакции не установлен",
  );
  fs.mkdirSync("artifacts/qa/issue-4", { recursive: true });
  await page.locator("#model-laboratory").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: "artifacts/qa/issue-4/berne-incomplete.png" });
  await expect(
    page.locator('[data-vector="psychological-stimulus"]'),
  ).toHaveCount(0);
});
test("emotion adapters execute independent scenario changes, baseline comparison and trace", async ({
  page,
}) => {
  const e = errors(page);
  await lab(page, "emotions", "Оценка ситуации", "appraisal");
  await expect(page.locator("[data-affect-point]")).toHaveCount(0);
  await expect(
    page.locator('[data-output="affect-description"]'),
  ).toContainText("Не представлено");
  await page.locator("#lab-reportedValence").selectOption("unpleasant");
  await page.locator("#lab-reportedArousal").selectOption("high");
  await expect(page.locator("[data-affect-point]")).toHaveAttribute("cx", "95");
  await expect(page.locator("[data-affect-point]")).toHaveAttribute("cy", "50");
  await page.locator('[data-lab-event="capture"]').click();
  const before = await observed(page);
  await page.locator("#lab-control").selectOption("high");
  const after = await observed(page);
  expect(after.dimensions).toEqual(before.dimensions);
  expect(after.appraisal.options).not.toEqual(before.appraisal.options);
  expect(after.changedFields).toEqual(["control"]);
  await expect(page.locator('[data-option="change-conditions"]')).toBeVisible();
  await expect(page.locator('.lab-options [data-option="change-conditions"]')).toContainText(
    "Учебная ветвь",
  );
  await page.screenshot({ path: `${qa}/emotions-comparison.png` });
  await page.locator("#lab-trace summary").first().click();
  await expect(page.locator("#lab-trace-content")).toContainText(
    "Адаптер описания аффекта",
  );
  await expect(page.locator("#lab-trace-content")).toContainText(
    "Адаптер оценки",
  );
  await expect(page.locator("#lab-trace-content")).toContainText(
    "Учебные варианты действий · не прогноз",
  );
  await expect(page.locator("#lab-trace-content .lab-source-span").first()).toContainText(
    "Фрагмент учебного правила",
  );
  await expect(page.locator("#lab-trace-content .lab-source-span").first()).toContainText(
    "Проектное учебное правило",
  );
  const frames = await page.evaluate(
    () => window.atlas.laboratory().getTrace().at(-1).evaluations,
  );
  expect(
    Object.keys(frames.find((x) => x.adapter === "dimensions").inputs),
  ).toEqual(["valence", "arousal"]);
  await page.locator("#lab-reset").click();
  expect((await observed(page)).baseline).toBeNull();
  expect((await state(page)).inputs.reportedArousal).toBeNull();
  expect(e).toEqual([]);
});
test("laboratory claim evidence, scientific boundaries and atlas switching stay accessible", async ({
  page,
}) => {
  await lab(page, "emotions", "Измерения аффекта", "affect");
  await page.locator('[data-claim="e-no-category"]').first().click();
  await expect(page.locator("#lab-evidence")).toHaveAttribute("open", "");
  await expect(page.locator("#lab-claim-e-no-category")).toContainText(
    "Учебная операционализация",
  );
  await expect(page.locator("#lab-claim-e-dimensions")).toContainText(
    "Положение подхода",
  );
  await expect(
    page.locator("#lab-claim-e-dimensions a").first(),
  ).toHaveAttribute("href", "https://doi.org/10.1037/h0077714");
  await page.locator("#lab-close").click();
  expect(await page.evaluate(() => window.atlas.getState().selected)).toBe(
    "affect",
  );
  await page.locator("#open-model").click();
  await expect(page.locator("#concept-model")).toHaveAttribute(
    "data-model",
    "affect",
  );
  await page.locator("#model-close").click();
  await page.locator("#atlas-picker").selectOption("berne");
  await expect(page.locator("#status")).toHaveText("37 понятий · 59 отношений");
});
test("mobile laboratory remains operable with unknown values, reset and readable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await lab(page, "emotions", "Оценка ситуации", "appraisal");
  await page.locator("#lab-control").selectOption("__unknown__");
  await page.locator("#lab-reportedValence").selectOption("pleasant");
  expect((await observed(page)).appraisal.canInfluence).toBeNull();
  await expect(page.locator("[data-affect-point]")).toHaveCount(0);
  await expect(page.locator("[data-affect-partial]")).toHaveCount(1);
  expect(
    await page
      .locator("#model-laboratory")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.locator(".lab-comparison-grid").scrollIntoViewIfNeeded();
  await page.locator("#lab-trace summary").first().click();
  await expect(page.locator("#lab-trace-content .lab-source-span").first()).toBeVisible();
  await page.locator("#lab-evidence summary").click();
  await expect(page.locator("#lab-claim-e-affordance .lab-source-span")).toBeVisible();
  expect(
    await page
      .locator("#model-laboratory")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: `${qa}/emotions-mobile.png` });
  await page.screenshot({ path: "artifacts/qa/issue-4/emotions-mobile-trace.png" });
  await page.locator("#lab-reset").click();
  await page.locator("#lab-close").click();
});
