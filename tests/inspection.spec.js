import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createModel } from "../src/model.js";
import { createInspection } from "../src/inspection.js";
const data = JSON.parse(fs.readFileSync("public/atlas.json", "utf8"));
test("semantic directions, predicate group counts and immutable global layouts", () => {
  const model = createModel(data),
    before = JSON.stringify(model.layouts),
    all = new Set(model.links.map((e) => e.id));
  for (const id of ["adult", "trans", "games"]) {
    const direct = model.graph.neighbors(id),
      nearby = new Set(direct);
    direct.forEach((n) =>
      model.graph.neighbors(n).forEach((x) => {
        if (x !== id) nearby.add(x);
      }),
    );
    const lens = createInspection(model, id, all, nearby);
    expect(lens.buckets.reduce((n, b) => n + b.edges.length, 0)).toBe(
      model.graph.degree(id),
    );
    lens.buckets.forEach((bucket) =>
      bucket.ids.forEach((other) => {
        expect(
          lens.positions[other].x * (bucket.direction === "in" ? -1 : 1),
        ).toBeGreaterThan(100);
      }),
    );
    lens.second.forEach((other) =>
      expect(lens.positions[other].z).toBeLessThan(-100),
    );
  }
  const t = createInspection(
    model,
    "trans",
    all,
    new Set(model.graph.neighbors("trans")),
  );
  expect(
    t.buckets.find((b) => b.relation === "включает или различает").ids,
  ).toHaveLength(5);
  expect(
    t.buckets.find((b) => b.relation === "связывает эго состояния").ids,
  ).toHaveLength(3);
  const adult = createInspection(
    model,
    "adult",
    all,
    new Set(model.graph.neighbors("adult")),
  );
  expect(
    adult.buckets.map((b) => [b.direction, b.relation, b.edges.length]),
  ).toEqual([
    ["in", "различает", 2],
    ["in", "связывает эго состояния", 1],
  ]);
  expect(JSON.stringify(model.layouts)).toBe(before);
});
