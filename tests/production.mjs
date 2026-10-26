import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
const executable =
  "/home/anton/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const port = 4184,
  url = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  let listening = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        listening = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!listening) throw Error("Production preview failed to start");
  browser = await chromium.launch({
    ...(existsSync(executable) ? { executablePath: executable } : {}),
    args: [
      "--no-sandbox",
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.atlas?.scene?.graph);
  const count = await page.locator("#status").textContent();
  if (count !== "37 понятий · 59 отношений")
    throw Error(`Unexpected graph ${count}`);
  await page.locator("#search").fill("Трансакция");
  await page.locator('[data-result="trans"]').click();
  await page.locator("#open-lab").click();
  await page.locator("#lab-responseFrom").selectOption("P");
  if (
    (await page.locator('[data-output="kind"]').innerText()) !==
    "Пересекающаяся"
  )
    throw Error("Production transaction runtime failed");
  await page.locator("#lab-close").click();
  await page.locator("#search").fill("Взрослый");
  await page.locator('[data-result="adult"]').click();
  await page.waitForTimeout(900);
  if ((await page.locator("#card h2").textContent()) !== "Взрослый")
    throw Error("Production concept selection failed");
  await page.locator("#fit-neighbors").click();
  await page.waitForTimeout(750);
  await page.screenshot({ path: "artifacts/3d-production-neighborhood.png" });
  await page.goto(`${url}/?atlas=emotions`);
  await page.waitForFunction(() => window.atlas?.data.id === "emotions");
  if (
    (await page.locator("#status").textContent()) !==
    "48 понятий · 77 отношений"
  )
    throw Error("Emotion atlas failed in production");
  await page.locator("#search").fill("Процессная модель регуляции");
  await page.locator('[data-result="regulation"]').click();
  await page.locator("#concept-model").waitFor({ state: "visible" });
  await page.locator('[name="strategy"]').selectOption("response");
  await page.locator('[name="goal"]').selectOption("experience");
  if (
    !(await page.locator("#model-result").innerText()).includes(
      "не доказывает уменьшения чувства",
    )
  )
    throw Error("Regulation interaction failed in production");
  await page.screenshot({
    path: "artifacts/emotions-production-regulation.png",
  });
  await page.locator("#model-close").click();
  await page.locator("#search").fill("Оценка ситуации");
  await page.locator('[data-result="appraisal"]').click();
  await page.locator("#open-lab-from-model").click();
  await page.locator("#lab-reportedValence").selectOption("unpleasant");
  await page.locator("#lab-reportedArousal").selectOption("high");
  await page.locator('[data-lab-event="capture"]').click();
  await page.locator("#lab-control").selectOption("high");
  const laboratory = await page.evaluate(() =>
    window.atlas.laboratory().getObservables(),
  );
  if (
    !laboratory.appraisal.options.includes("change-conditions") ||
    laboratory.dimensions.point.valence !== "unpleasant" ||
    laboratory.changedFields.join() !== "control"
  )
    throw Error("Production comparison adapter failed");
  await page.screenshot({
    path: "artifacts/qa/model-lab/production-comparison.png",
  });
  await page.goto(`${url}/?atlas=leontiev`);
  await page.waitForFunction(() => window.atlas?.data.id === "leontiev");
  if (
    (await page.locator("#status").textContent()) !==
    "21 понятий · 27 отношений"
  )
    throw Error("Leontiev atlas failed in production");
  await page.locator("#search").fill("Деятельность");
  await page.locator('[data-result="activity"]').click();
  await page.locator("#open-lab").click();
  await page.locator("#lab-conditions").selectOption("digital");
  if (
    (await page.locator('[data-object="digital-highlight"]').count()) !== 1 ||
    (await page.locator('[data-object="paper-cards"]').count()) !== 0
  )
    throw Error("Leontiev model failed in production");
  await page.locator('[data-model="leontiev-sense"]').click();
  await page.locator('[data-model="leontiev-emotion"]').click();
  if (
    !(await page.locator('[data-output="signal"]').textContent()).includes(
      "не задаёт эмоцию",
    )
  )
    throw Error("Leontiev emotion boundary failed in production");
  if (errors.length) throw Error(errors.join("\n"));
  const report = {
    passed: true,
    nodes: 37,
    relations: 59,
    webgl: true,
    emotions: { nodes: 48, relations: 77, regulationModel: true },
    leontiev: { nodes: 21, relations: 27, models: 3 },
    concept: "Взрослый",
    modelLaboratory: { berne: true, emotions: true, adapterIsolation: true },
    consoleAndHttpErrors: errors,
  };
  writeFileSync(
    "artifacts/3d-production-results.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
