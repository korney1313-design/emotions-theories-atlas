import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { createModel } from "../src/model.js";
import { modelCatalog } from "../src/content-models.js";
const data = JSON.parse(
  fs.readFileSync("public/atlases/emotions.json", "utf8"),
);
const byModel = Object.fromEntries(
  Object.keys(modelCatalog).map((key) => [
    key,
    data.nodes.find((n) => n.model === key),
  ]),
);
async function ready(page) {
  await page.goto("/?atlas=emotions");
  await page.waitForFunction(() => window.atlas?.data.id === "emotions");
  await expect(page.locator("#status")).toHaveText("48 понятий · 77 отношений");
}
async function choose(page, node) {
  await page.locator("#search").fill(node.label);
  await page.locator(`[data-result="${node.id}"]`).click();
  await expect(page.locator("#concept-model")).toBeVisible();
  await expect(page.locator("#concept-model")).toHaveAttribute(
    "data-model",
    node.model,
  );
}
function errors(page) {
  const result = [];
  page.on("pageerror", (e) => result.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") result.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) result.push(`${r.status()} ${r.url()}`);
  });
  return result;
}

test("lecture coverage, source integrity and separation from cancelled prototype", () => {
  const manifest = JSON.parse(
      fs.readFileSync("sources/emotions/manifest.json", "utf8"),
    ),
    lecture = JSON.parse(
      fs.readFileSync("sources/emotions/slides-and-notes.json", "utf8"),
    );
  expect(manifest.slides).toBe(39);
  expect(manifest.slidesWithNotes).toBe(39);
  expect(lecture).toHaveLength(39);
  for (const [name, hash] of Object.entries(manifest.files))
    expect(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(`../${name}`))
        .digest("hex"),
    ).toBe(hash);
  const graph = createModel(data).graph;
  expect(graph.order).toBe(48);
  expect(graph.size).toBe(77);
  expect(new Set(data.nodes.map((n) => n.section)).size).toBe(8);
  expect(Object.keys(modelCatalog)).toHaveLength(15);
  expect(data.nodes.some((n) => /Джеймс|Кэннон|Шахтер/.test(n.label))).toBe(
    false,
  );
  expect(data.references).toHaveLength(11);
  for (const n of data.nodes) {
    expect(modelCatalog[n.model]).toBeTruthy();
    expect(n.limit.length).toBeGreaterThan(30);
    expect(n.provenance.notes).toBe(true);
    for (const num of n.provenance.slides)
      expect(lecture.find((s) => s.number === num)?.notes).toBeTruthy();
  }
  for (const e of data.edges) {
    expect(e.provenance.slides.length).toBeGreaterThan(0);
    expect(graph.hasNode(e.source) && graph.hasNode(e.target)).toBe(true);
  }
  expect(data.nodes.filter((n) => n.kind === "подход").length).toBeGreaterThan(
    5,
  );
});

test("emotions overview, graph inspection and preserved Berne atlas", async ({
  page,
}) => {
  const e = errors(page);
  await ready(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/emotions-overview.png" });
  await choose(
    page,
    data.nodes.find((n) => n.id === "construction"),
  );
  await page.locator("#model-close").click();
  await expect(page.locator("#card h2")).toHaveText("Конструирование эмоции");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/emotions-construction-graph.png" });
  await page.locator('#card [data-node="interoception"]').click();
  await expect(page.locator("#concept-model")).toBeVisible();
  await page.locator("#model-close").click();
  await page.locator("#back").click();
  await expect(page.locator("#concept-model")).toHaveAttribute(
    "data-node",
    "construction",
  );
  await page.locator("#model-close").click();
  await page.locator("#home").click();
  await page.locator('input[value="ограничение"]').uncheck();
  await expect(page.locator("#status")).not.toHaveText(
    "48 понятий · 77 отношений",
  );
  await page.locator('input[value="ограничение"]').check();
  await page.locator("#atlas-picker").selectOption("berne");
  await page.waitForFunction(() => !!window.atlas && !window.atlas.data.id);
  await expect(page.locator("#status")).toHaveText("37 понятий · 59 отношений");
  await page.locator("#search").fill("Взрослый");
  await page.locator('[data-result="adult"]').click();
  await expect(page.locator("#card h2")).toHaveText("Взрослый");
  await expect(page.locator("#concept-model")).toHaveCount(0);
  expect(e).toEqual([]);
});

for (const [key, node] of Object.entries(byModel)) {
  test(`interactive content: ${key}`, async ({ page }) => {
    const e = errors(page);
    await ready(page);
    await choose(page, node);
    await expect(page.locator("#model-result")).not.toContainText("undefined");
    const before = await page.locator("#model-result").innerText();
    const select = page.locator("#model-controls select").first();
    if (await select.count()) {
      const values = await select
        .locator("option")
        .evaluateAll((options) => options.map((o) => o.value));
      await select.selectOption(values.at(-1));
    } else if (
      await page.locator('#model-controls input[type="range"]').count()
    ) {
      await page.locator('#model-controls input[type="range"]').first().focus();
      await page.keyboard.press("End");
    } else {
      await page
        .locator('#model-controls input[type="checkbox"]')
        .first()
        .uncheck();
    }
    await expect(page.locator("#model-result")).not.toHaveText(before, {
      useInnerText: true,
    });
    await expect(
      page.locator("#model-result .scientific-boundary"),
    ).toBeVisible();
    await page.screenshot({ path: `artifacts/emotions-model-${key}.png` });
    await page.locator("#model-sources summary").click();
    await expect(page.locator("#source-text")).toContainText(
      "Заметки преподавателя",
    );
    await expect(page.locator("#source-text")).not.toContainText(
      "Загрузка исходных заметок",
    );
    if (key === "grief") {
      await page.locator('[data-step="grief"]').click();
      await page.locator('[data-step="grief"]').click();
      await expect(page.locator("#model-result")).toContainText(
        "2. Восстановление",
      );
      await page.locator('[data-reset="grief"]').click();
      await expect(page.locator("#model-result")).toContainText(
        "Добавляйте шаги",
      );
    }
    if (key === "affect") {
      await expect(page.locator(".affect-plane circle")).toHaveAttribute(
        "cx",
        "385",
      );
    }
    if (key === "regulation") {
      await page.locator('[name="strategy"]').selectOption("response");
      await page.locator('[name="goal"]').selectOption("experience");
      await expect(page.locator("#model-result")).toContainText(
        "не доказывает уменьшения чувства",
      );
    }
    if (key === "evidence") {
      for (const check of await page
        .locator('#model-controls input[type="checkbox"]')
        .all())
        await check.check();
      await expect(page.locator("#model-result")).toContainText(
        "не доказывает",
      );
    }
    await page.locator("#model-reset").click();
    await expect(page.locator("#model-result")).toHaveText(before, {
      useInnerText: true,
    });
    expect(e).toEqual([]);
  });
}

test("responsive conceptual model", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await ready(page);
  await choose(page, byModel.regulation);
  expect(
    await page
      .locator("#concept-model")
      .evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: "artifacts/emotions-mobile.png",
    fullPage: true,
  });
});
