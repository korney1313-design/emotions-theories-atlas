import {
  forceSimulation,
  forceX,
  forceY,
  forceZ,
  forceCollide,
} from "d3-force-3d";
import { seededRandom } from "./model.js";

// A temporary semantic lens, never written over the theory's overview layout.
// X encodes CSV direction; buckets encode predicate; Z encodes graph distance.
export function createInspection(model, selected, visibleEdges, nearby) {
  const buckets = new Map(),
    direct = new Set(),
    positions = { [selected]: { x: 0, y: 0, z: 0 } },
    sides = { in: [], out: [] };
  model.links
    .filter(
      (e) =>
        visibleEdges.has(e.id) &&
        (e.source === selected || e.target === selected),
    )
    .forEach((e) => {
      const direction = e.target === selected ? "in" : "out",
        other = direction === "in" ? e.source : e.target;
      const key = `${direction}:${e.relation}`;
      if (!buckets.has(key))
        buckets.set(key, {
          key,
          direction,
          relation: e.relation,
          ids: [],
          edges: [],
        });
      const b = buckets.get(key);
      if (!b.ids.includes(other)) b.ids.push(other);
      b.edges.push(e.id);
      direct.add(other);
    });
  for (const b of buckets.values()) sides[b.direction].push(b);
  for (const direction of ["in", "out"]) {
    const list = sides[direction],
      total = list.reduce((n, b) => n + b.ids.length * 68 + 30, 0) - 30;
    let cursor = total / 2;
    for (const bucket of list) {
      bucket.ids.sort((a, b) =>
        model.graph
          .getNodeAttribute(a, "label")
          .localeCompare(model.graph.getNodeAttribute(b, "label"), "ru"),
      );
      const ys = [];
      bucket.ids.forEach((id, i) => {
        const y = cursor - i * 68;
        ys.push(y);
        if (!positions[id])
          positions[id] = { x: direction === "in" ? -215 : 215, y, z: 0 };
      });
      bucket.anchor = {
        x: direction === "in" ? -112 : 112,
        y: (ys.reduce((a, b) => a + b, 0) / ys.length) * 0.65,
        z: 15,
      };
      cursor -= bucket.ids.length * 68 + 30;
    }
  }
  const second = [...nearby].filter((id) => id !== selected && !direct.has(id));
  second.forEach((id, i) => {
    const angle = (i / Math.max(1, second.length)) * Math.PI * 2;
    positions[id] = {
      x: Math.cos(angle) * 290,
      y: Math.sin(angle) * 230,
      z: -230,
    };
  });
  const particles = Object.entries(positions).map(([id, p]) => ({
    id,
    ...p,
    goal: p,
    fx: id === selected ? 0 : undefined,
    fy: id === selected ? 0 : undefined,
    fz: id === selected ? 0 : undefined,
  }));
  const sim = forceSimulation(particles, 3)
    .stop()
    .randomSource(seededRandom())
    .force("x", forceX((n) => n.goal.x).strength(0.8))
    .force("y", forceY((n) => n.goal.y).strength(0.8))
    .force("z", forceZ((n) => n.goal.z).strength(0.8))
    .force("collide", forceCollide(29).iterations(3));
  sim.tick(100);
  sim.stop();
  particles.forEach((n) => (positions[n.id] = { x: n.x, y: n.y, z: n.z }));
  return {
    positions,
    buckets: [...buckets.values()],
    direct,
    second: new Set(second),
  };
}
