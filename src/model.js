import { DirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import pagerank from "graphology-metrics/centrality/pagerank.js";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d";

export const palette = [
  "#83a9ed",
  "#58c3b5",
  "#e7be76",
  "#bc9ced",
  "#ec9685",
  "#a9cb7b",
  "#7bc1e0",
  "#df9ac2",
];
export const layoutVersion = "atlas-3d-v1";
export const coordinates = (nodes) =>
  Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]));
export function seededRandom(seed = 92481) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function createModel(data) {
  const graph = new DirectedGraph();
  data.nodes.forEach((n) => graph.addNode(n.id, { ...n }));
  data.edges.forEach((e) =>
    graph.addDirectedEdgeWithKey(e.id, e.source, e.target, { ...e }),
  );
  pagerank.assign(graph);
  louvain.assign(graph, { randomWalk: false });
  const nodes = graph.mapNodes((id, a) => ({
    ...a,
    id,
    radius: 3.5 + Math.sqrt(a.pagerank) * 24,
  }));
  const links = data.edges.map((e) => ({ ...e }));
  const layouts = {},
    centers = {};
  for (const mode of ["section", "community"]) {
    const groups = [...new Set(nodes.map((n) => n[mode]))];
    centers[mode] = Object.fromEntries(
      groups.map((g, i) => {
        const angle = (i / groups.length) * Math.PI * 2 + Math.PI / 8;
        return [
          g,
          {
            x: Math.cos(angle) * 285,
            y: Math.sin(angle) * 235,
            z: Math.sin(angle * 2 + 0.6) * 105,
          },
        ];
      }),
    );
    const random = seededRandom();
    const particles = nodes.map((n) => {
      const c = centers[mode][n[mode]];
      return {
        ...n,
        x: c.x + (random() - 0.5) * 140,
        y: c.y + (random() - 0.5) * 140,
        z: c.z + (random() - 0.5) * 140,
      };
    });
    const sim = forceSimulation(particles, 3)
      .stop()
      .randomSource(seededRandom())
      .force(
        "link",
        forceLink(links.map((e) => ({ ...e })))
          .id((n) => n.id)
          .distance((e) => (e.source[mode] === e.target[mode] ? 75 : 330))
          .strength((e) => (e.source[mode] === e.target[mode] ? 0.12 : 0.007)),
      )
      .force("charge", forceManyBody().strength(-95))
      .force("collision", forceCollide((n) => n.radius + 22).iterations(3))
      .force("x", forceX((n) => centers[mode][n[mode]].x).strength(0.24))
      .force("y", forceY((n) => centers[mode][n[mode]].y).strength(0.24))
      .force("z", forceZ((n) => centers[mode][n[mode]].z).strength(0.24));
    sim.tick(360);
    sim.stop();
    layouts[mode] = coordinates(particles);
  }
  return { graph, nodes, links, layouts, centers };
}

// Cache is invalidated by every semantic or algorithm input change.
export function layoutFingerprint(data) {
  const value = JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${layoutVersion}-${(hash >>> 0).toString(16)}`;
}
export function validLayout(value, ids) {
  return (
    value &&
    ids.every(
      (id) =>
        value[id] &&
        ["x", "y", "z"].every(
          (axis) =>
            Number.isFinite(value[id][axis]) &&
            Math.abs(value[id][axis]) < 10000,
        ),
    )
  );
}
