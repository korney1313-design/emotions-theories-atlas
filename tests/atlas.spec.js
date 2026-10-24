import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createModel, layoutFingerprint, validLayout } from "../src/model.js";
const data = JSON.parse(fs.readFileSync("public/atlas.json", "utf8"));
const getState = (page) => page.evaluate(() => window.atlas.getState());
async function ready(page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.atlas);
  await expect(page.locator("#status")).toHaveText("37 понятий · 59 отношений");
}
async function search(page, query, id) {
  await page.getByLabel("Поиск понятий").fill(query);
  await page.locator(`[data-result="${id}"]`).click();
  await expect(page.locator("#card h2")).toHaveText(query);
  await page.waitForTimeout(850);
}
function checkErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

test("semantic model, deterministic physical layout and actual non-planar 3D", () => {
  const a = createModel(data),
    b = createModel(data);
  expect(a.graph.order).toBe(37);
  expect(a.graph.size).toBe(59);
  expect(a.layouts).toEqual(b.layouts);
  expect(a.links.map((e) => [e.source, e.relation, e.target])).toEqual(
    data.edges.map((e) => [e.source, e.relation, e.target]),
  );
  for (const mode of ["section", "community"]) {
    expect(
      validLayout(
        a.layouts[mode],
        data.nodes.map((n) => n.id),
      ),
    ).toBeTruthy();
    const pts = Object.values(a.layouts[mode]);
    for (const axis of ["x", "y", "z"])
      expect(
        Math.max(...pts.map((p) => p[axis])) -
          Math.min(...pts.map((p) => p[axis])),
      ).toBeGreaterThan(100);
    const p = pts.slice(0, 4),
      sub = (a, b) => ["x", "y", "z"].map((k) => a[k] - b[k]),
      [u, v, w] = p.slice(1).map((x) => sub(x, p[0]));
    const determinant =
      u[0] * (v[1] * w[2] - v[2] * w[1]) -
      u[1] * (v[0] * w[2] - v[2] * w[0]) +
      u[2] * (v[0] * w[1] - v[1] * w[0]);
    expect(Math.abs(determinant)).toBeGreaterThan(1000);
  }
  a.graph.forEachNode((id, n) => {
    expect(n.pagerank).toBeGreaterThan(0);
    expect(n.community).toBeGreaterThanOrEqual(0);
  });
  expect(layoutFingerprint(data)).toBe(layoutFingerprint(data));
  expect(data.provenance.comparison.edge_triples_match).toBe(true);
});

test("WebGL 3D rendering, mouse orbit, pan, wheel zoom and saved coordinates", async ({
  page,
}) => {
  const errors = checkErrors(page);
  await ready(page);
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(
      () => window.atlas.scene.graph.camera().isPerspectiveCamera,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.atlas.scene.graph.numDimensions()),
  ).toBe(3);
  await expect(page.locator("#graph canvas")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/3d-overview.png" });
  const before = await page.evaluate(() => ({
    pos: window.atlas.scene.graph.camera().position.toArray(),
    quat: window.atlas.scene.graph.camera().quaternion.toArray(),
  }));
  const canvas = await page.locator("#graph canvas").boundingBox();
  await page.mouse.move(
    canvas.x + canvas.width * 0.8,
    canvas.y + canvas.height * 0.8,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + canvas.width * 0.57,
    canvas.y + canvas.height * 0.65,
    { steps: 18 },
  );
  await page.mouse.up();
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => ({
    pos: window.atlas.scene.graph.camera().position.toArray(),
    quat: window.atlas.scene.graph.camera().quaternion.toArray(),
  }));
  expect(after.pos).not.toEqual(before.pos);
  expect(after.quat).not.toEqual(before.quat);
  await page.screenshot({ path: "artifacts/3d-rotated.png" });
  const distance = await page.evaluate(() => window.atlas.scene.distance());
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.atlas.scene.distance())).toBeLessThan(
    distance,
  );
  const panBefore = await page.evaluate(() =>
    window.atlas.scene.graph.controls().target.toArray(),
  );
  await page.mouse.move(
    canvas.x + canvas.width * 0.8,
    canvas.y + canvas.height * 0.8,
  );
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    canvas.x + canvas.width * 0.85,
    canvas.y + canvas.height * 0.75,
    { steps: 10 },
  );
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      window.atlas.scene.graph.controls().target.toArray(),
    ),
  ).not.toEqual(panBefore);
  await page.locator("#home").click();
  await page.waitForTimeout(750);
  const nodePoint = await page.evaluate(() => {
    const s = window.atlas.scene;
    return s.project(s.nodeMap.get("ta"));
  });
  await page.mouse.click(canvas.x + nodePoint.x, canvas.y + nodePoint.y);
  await expect(page.locator("#card h2")).toHaveText("Транзактный анализ");
  await page.locator("#home").click();
  await page.waitForTimeout(750);
  const saved = await page.evaluate(() => window.atlas.scene.layouts.section);
  await page.reload();
  await page.waitForFunction(() => !!window.atlas);
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        window.atlas.scene.nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]),
      ),
    ),
  ).toEqual(saved);
  expect(errors).toEqual([]);
});

for (const [id, label] of [
  ["adult", "Взрослый"],
  ["trans", "Трансакция"],
  ["games", "Психологические игры"],
]) {
  test(`exploration: ${label}, focus, neighbors, relations and history`, async ({
    page,
  }) => {
    const errors = checkErrors(page);
    await ready(page);
    const positions = await page.evaluate(() =>
      window.atlas.scene.nodes.map((n) => [n.id, n.x, n.y, n.z]),
    );
    await search(page, label, id);
    expect((await getState(page)).selected).toBe(id);
    await expect(page.locator(`#annotations [data-key="${id}"]`)).toBeVisible();
    const target = await page.evaluate(() => {
      const s = window.atlas.scene,
        n = s.nodeMap.get(window.atlas.getState().selected);
      return {
        target: s.graph.controls().target.toArray(),
        node: [n.x, n.y, n.z],
        highlighted: s.meshes.get(n.id).halo.material.opacity,
      };
    });
    for (let i = 0; i < 3; i++)
      expect(target.target[i]).toBeCloseTo(target.node[i], 1);
    expect(target.highlighted).toBeGreaterThan(0);
    const expected = data.edges.filter(
      (e) => e.source === id || e.target === id,
    );
    await expect(page.locator("[data-edge-row]")).toHaveCount(expected.length);
    expect((await getState(page)).nearby.length).toBeGreaterThan(0);
    const boxes = await page.evaluate(() => window.atlas.scene.labelBoxes);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        expect(
          a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y,
        ).toBe(false);
      }
    const directIds = await page.evaluate(() => [
      ...window.atlas.scene.inspection.direct,
    ]);
    for (const neighbor of directIds)
      await expect(
        page.locator(`#annotations [data-key="${neighbor}"]`),
      ).toBeVisible();
    const predicates = await page.evaluate(() =>
      window.atlas.scene.inspection.buckets.map((b) => `predicate-${b.key}`),
    );
    for (const key of predicates)
      await expect(
        page.locator("#annotations").locator(`[data-key="${key}"]`),
      ).toBeVisible();
    const inCount = expected.filter((e) => e.target === id).length,
      outCount = expected.filter((e) => e.source === id).length;
    await expect(page.locator("#semantic-guide")).toContainText(
      `Входящие: ${inCount}`,
    );
    await expect(page.locator("#semantic-guide")).toContainText(
      `Исходящие: ${outCount}`,
    );
    const projected = await page.evaluate(() => {
      const s = window.atlas.scene;
      return [...s.inspection.direct].map((id) => s.project(s.nodeMap.get(id)));
    });
    const bounds = await page.locator("#graph").boundingBox();
    for (const p of projected) {
      expect(p.x).toBeGreaterThan(20);
      expect(p.x).toBeLessThan(bounds.width - 20);
      expect(p.y).toBeGreaterThan(20);
      expect(p.y).toBeLessThan(bounds.height - 20);
    }
    await page.screenshot({ path: `artifacts/3d-${id}.png` });
    await page.locator(`[data-edge="${expected[0].id}"]`).click();
    await expect(page.locator("#edge-inspector")).toContainText(
      expected[0].relation,
    );
    await expect(page.locator("#edge-inspector")).toContainText(
      "berne_edges.csv",
    );
    await page.locator("#expand").click();
    expect((await getState(page)).expanded).toBe(true);
    await page.waitForTimeout(800);
    const depthCorrect = await page.evaluate(() => {
      const s = window.atlas.scene;
      return [...s.inspection.second].every(
        (id) => s.nodeMap.get(id).z < s.inspectionOrigin.z - 100,
      );
    });
    expect(depthCorrect).toBe(true);
    await page.screenshot({ path: `artifacts/3d-${id}-depth2.png` });
    const expanded = (await getState(page)).nearby.length;
    await page.locator("#expand").click();
    expect((await getState(page)).nearby.length).toBeLessThanOrEqual(expanded);
    const other =
      expected[0].source === id ? expected[0].target : expected[0].source;
    await page.locator(`#card [data-node="${other}"]`).first().click();
    expect((await getState(page)).selected).toBe(other);
    await page.locator("#back").click();
    expect((await getState(page)).selected).toBe(id);
    await expect(page.locator(`#annotations [data-key="${id}"]`)).toBeVisible();
    await page.locator("#forward").click();
    expect((await getState(page)).selected).toBe(other);
    await page.locator("#home").click();
    expect((await getState(page)).selected).toBeNull();
    expect(
      await page.evaluate(() =>
        window.atlas.scene.nodes.map((n) => [n.id, n.x, n.y, n.z]),
      ),
    ).toEqual(positions);
    expect(errors).toEqual([]);
  });
}

test("filtering, live 3D regrouping preserves selection, cache and semantic provenance", async ({
  page,
}) => {
  const errors = checkErrors(page);
  await ready(page);
  await page.locator('input[value="теоретическая"]').uncheck();
  await expect(page.locator("#status")).toHaveText("37 понятий · 18 отношений");
  await page.locator('input[value="теоретическая"]').check();
  await page.locator("#relation").selectOption("различает");
  await expect(page.locator("#status")).toHaveText("37 понятий · 8 отношений");
  await page.locator("#relation").selectOption("");
  await search(page, "Взрослый", "adult");
  const original = await page.evaluate(() =>
    window.atlas.scene.nodes.map((n) => [n.x, n.y, n.z]),
  );
  await page.locator("#communities").click();
  expect((await getState(page)).selected).toBe("adult");
  await expect(page.locator("#card h2")).toHaveText("Взрослый");
  await expect(page.locator("#group-note")).toContainText("Louvain");
  await page.waitForFunction(() => window.atlas.getState().stable, {
    timeout: 15000,
  });
  expect(
    await page.evaluate(() =>
      window.atlas.scene.nodes.map((n) => [n.x, n.y, n.z]),
    ),
  ).not.toEqual(original);
  await page.locator("#home").click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/3d-communities.png" });
  await page.locator("#sections").click();
  await page.waitForFunction(() => window.atlas.getState().stable, {
    timeout: 15000,
  });
  await page.locator('[data-group="Эго-состояния"]').click();
  await expect(page.locator("#status")).toContainText("10 понятий");
  await page.locator("#home").click();
  await page.locator("#about").click();
  await expect(page.locator("#info")).toContainText("d3-force-3d");
  await page.locator("#close-info").click();
  await page.locator("#search").fill("абракадабра");
  await expect(page.locator("#results")).toContainText("Ничего не найдено");
  expect(errors).toEqual([]);
});

test("responsive scene and keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await ready(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(760);
  await page.keyboard.press("/");
  await page.keyboard.type("dummy");
  await page.locator("#search").fill("Взрослый");
  await page.keyboard.press("Enter");
  await expect(page.locator("#card h2")).toHaveText("Взрослый");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "artifacts/3d-mobile.png", fullPage: true });
});
