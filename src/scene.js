import { createInspection } from "./inspection.js";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { forceX, forceY, forceZ, forceCollide } from "d3-force-3d";
import { palette, coordinates, validLayout } from "./model.js";

const origin = new THREE.Vector3();
const sourceId = (link) =>
  typeof link.source === "object" ? link.source.id : link.source;
const targetId = (link) =>
  typeof link.target === "object" ? link.target.id : link.target;
export { sourceId, targetId };

export class AtlasScene {
  constructor(container, overlay, model, key, callbacks) {
    this.model = model;
    this.container = container;
    this.overlay = overlay;
    this.key = key;
    this.callbacks = callbacks;
    this.mode = "section";
    this.selected = null;
    this.hovered = null;
    this.focusedEdge = null;
    this.nearby = new Set();
    this.visibleNodes = new Set(model.nodes.map((n) => n.id));
    this.visibleEdges = new Set(model.links.map((e) => e.id));
    this.layouts = structuredClone(model.layouts);
    this.storageAvailable = true;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      for (const m of ["section", "community"])
        if (
          validLayout(
            saved?.[m],
            model.nodes.map((n) => n.id),
          )
        )
          this.layouts[m] = saved[m];
    } catch {
      this.storageAvailable = false;
    }
    this.nodes = model.nodes.map((n) => ({
      ...n,
      ...this.layouts.section[n.id],
    }));
    this.links = model.links.map((e) => ({ ...e }));
    this.nodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    this.nodes.forEach((n) => {
      n.fx = n.x;
      n.fy = n.y;
      n.fz = n.z;
    });
    this.meshes = new Map();
    this.labelElements = new Map();
    this.stable = true;
    this.graph = new ForceGraph3D(container, {
      controlType: "orbit",
      rendererConfig: { antialias: true, alpha: false },
    })
      .backgroundColor("#101d2b")
      .width(container.clientWidth)
      .height(container.clientHeight)
      .numDimensions(3)
      .forceEngine("d3")
      .enableNodeDrag(false)
      .showNavInfo(false)
      .nodeLabel(() => null)
      .linkLabel(() => null)
      .nodeThreeObject((n) => this.nodeObject(n))
      .nodeVisibility((n) => this.visibleNodes.has(n.id))
      .linkVisibility((e) => this.visibleEdges.has(e.id))
      .linkColor((e) => this.linkColor(e))
      .linkWidth((e) => (this.incident(e) ? 1.4 : this.selected ? 0.35 : 0.5))
      .linkOpacity(0.6)
      .linkDirectionalArrowLength((e) =>
        this.incident(e) ? 6 : this.selected ? 0 : 2.5,
      )
      .linkDirectionalArrowRelPos(0.88)
      .linkDirectionalArrowColor((e) => this.linkColor(e))
      .linkHoverPrecision(3)
      .cooldownTicks(0)
      .onNodeClick((n) => callbacks.choose(n.id))
      .onNodeHover((n) => {
        this.hovered = n?.id;
        this.labelsDirty = true;
      })
      .onLinkClick((e) => callbacks.selectEdge(e.id))
      .onLinkHover((e) => {
        this.hoveredEdge = e?.id;
        this.labelsDirty = true;
      })
      .onBackgroundClick((event) => {
        const hit = this.pickNodeAt(event);
        if (hit) callbacks.choose(hit.id);
        else callbacks.background();
      })
      .onEngineStop(() => this.freeze())
      .graphData({ nodes: this.nodes, links: this.links });
    this.graph.d3Force("center", null);
    this.graph.d3Force("charge", null);
    this.graph.d3Force("link").strength(0.005);
    this.graph.lights([
      new THREE.AmbientLight("#c7dfff", 2.2),
      new THREE.HemisphereLight("#e3f4ff", "#203d4e", 2),
    ]);
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(-200, 500, 600);
    this.graph.scene().add(light);
    this.groupObjects = new THREE.Group();
    this.graph.scene().add(this.groupObjects);
    const controls = this.graph.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 100;
    controls.maxDistance = 3200;
    controls.rotateSpeed = 0.7;
    controls.panSpeed = 0.8;
    this.graph.camera().near = 0.5;
    this.graph.camera().far = 10000;
    this.graph.camera().updateProjectionMatrix();
    this.graph.cameraPosition({ x: 80, y: 55, z: 880 }, origin, 0);
    this.resizeObserver = new ResizeObserver(() => {
      this.graph.width(container.clientWidth).height(container.clientHeight);
      this.labelsDirty = true;
    });
    this.resizeObserver.observe(container);
    this.buildLabels();
    // Projected labels are siblings of the WebGL canvas. Forward their wheel
    // events so zoom works identically over text and empty scene space.
    this.overlay.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.graph.renderer().domElement.dispatchEvent(
          new WheelEvent("wheel", {
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode,
            clientX: event.clientX,
            clientY: event.clientY,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { passive: false },
    );
    this.buildGroups();
    this.save();
    let previous = 0;
    const tick = (time) => {
      this.frame = requestAnimationFrame(tick);
      if (time - previous < 32) return;
      previous = time;
      if (!this.stable) this.updateGroups();
      this.drawLabels();
      this.callbacks.level(this.distance());
    };
    this.frame = requestAnimationFrame(tick);
    this.controlsChange = () => {
      this.labelsDirty = true;
    };
    controls.addEventListener("change", this.controlsChange);
  }
  nodeObject(n) {
    const group = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(n.radius, 22, 16),
      new THREE.MeshStandardMaterial({
        color: this.color(n),
        roughness: 0.32,
        metalness: 0.18,
        transparent: true,
        opacity: 1,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(n.radius * 1.65, 18, 12),
      new THREE.MeshBasicMaterial({
        color: "#e3fff5",
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    group.add(sphere, halo);
    this.meshes.set(n.id, { sphere, halo, group });
    return group;
  }
  groups() {
    return [...new Set(this.nodes.map((n) => n[this.mode]))];
  }
  color(n) {
    return palette[this.groups().indexOf(n[this.mode]) % palette.length];
  }
  incident(e) {
    return (
      sourceId(e) === this.selected ||
      targetId(e) === this.selected ||
      e.id === this.focusedEdge
    );
  }
  linkColor(e) {
    if (e.id === this.focusedEdge) return "#ffe2a5";
    if (this.incident(e))
      return e.status === "методическая"
        ? "#7ee5cd"
        : e.status === "аналитическая"
          ? "#edc07c"
          : "#afcfff";
    if (this.selected)
      return this.nearby.has(sourceId(e)) && this.nearby.has(targetId(e))
        ? "#5b7889"
        : "#192c3b";
    return "#607a91";
  }
  update({ selected, nearby, visibleNodes, visibleEdges, focusedEdge }) {
    this.selected = selected;
    this.nearby = nearby;
    this.visibleNodes = visibleNodes;
    this.visibleEdges = visibleEdges;
    this.focusedEdge = focusedEdge;
    this.nodes.forEach((n) => {
      const m = this.meshes.get(n.id);
      if (!m) return;
      const active = !selected || n.id === selected || nearby.has(n.id);
      m.sphere.material.color.set(active ? this.color(n) : "#435464");
      m.sphere.material.opacity = active ? 1 : 0.11;
      m.sphere.scale.setScalar(n.id === selected ? 1.35 : 1);
      m.halo.material.opacity = n.id === selected ? 0.38 : 0;
    });
    this.graph
      .nodeVisibility(this.graph.nodeVisibility())
      .linkVisibility(this.graph.linkVisibility())
      .linkColor(this.graph.linkColor())
      .linkWidth(this.graph.linkWidth())
      .linkDirectionalArrowLength(this.graph.linkDirectionalArrowLength());
    this.groupObjects.visible = !selected;
    this.applyInspection();
    this.labelsDirty = true;
  }
  freeze() {
    if (!this.nodes) return;
    if (this.inspection) {
      this.stable = true;
      this.callbacks.stable?.(this.storageAvailable);
      return;
    }
    this.nodes.forEach((n) => {
      n.fx = n.x;
      n.fy = n.y;
      n.fz = n.z;
    });
    this.stable = true;
    this.layouts[this.mode] = coordinates(this.nodes);
    this.save();
    this.updateGroups();
    this.callbacks.stable?.(this.storageAvailable);
  }
  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.layouts));
    } catch {
      this.storageAvailable = false;
    }
  }
  setMode(mode) {
    if (mode === this.mode) return;
    if (this.inspection) this.restoreOverview();
    this.layouts[this.mode] = coordinates(this.nodes);
    this.mode = mode;
    this.stable = false;
    const target = this.layouts[mode];
    if (this.selected) {
      this.nodes.forEach((n) => this.setPosition(n, target[n.id]));
      this.inspectionSignature = null;
      this.buildGroups();
      this.update({
        selected: this.selected,
        nearby: this.nearby,
        visibleNodes: this.visibleNodes,
        visibleEdges: this.visibleEdges,
        focusedEdge: this.focusedEdge,
      });
      this.stable = true;
      this.callbacks.stable?.(this.storageAvailable);
      return;
    }
    this.nodes.forEach((n) => {
      delete n.fx;
      delete n.fy;
      delete n.fz;
      n.vx = n.vy = n.vz = 0;
    });
    this.graph
      .d3Force("x", forceX((n) => target[n.id].x).strength(0.16))
      .d3Force("y", forceY((n) => target[n.id].y).strength(0.16))
      .d3Force("z", forceZ((n) => target[n.id].z).strength(0.16))
      .d3Force("collision", forceCollide((n) => n.radius + 18).iterations(2))
      .d3AlphaDecay(0.055)
      .d3VelocityDecay(0.55)
      .cooldownTicks(100)
      .d3ReheatSimulation();
    this.buildGroups();
    this.update({
      selected: this.selected,
      nearby: this.nearby,
      visibleNodes: this.visibleNodes,
      visibleEdges: this.visibleEdges,
      focusedEdge: this.focusedEdge,
    });
    this.callbacks.moving?.();
  }
  buildGroups() {
    for (const object of [...this.groupObjects.children]) {
      object.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
      this.groupObjects.remove(object);
    }
    this.groupMeshes = [];
    this.groups().forEach((g, i) => {
      const shell = new THREE.Group();
      shell.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(1, 24, 16),
          new THREE.MeshBasicMaterial({
            color: palette[i % palette.length],
            transparent: true,
            opacity: 0.035,
            depthWrite: false,
            side: THREE.BackSide,
          }),
        ),
      );
      for (let axis = 0; axis < 3; axis++) {
        const points = Array.from({ length: 81 }, (_, j) => {
          const a = (j / 80) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
        });
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: palette[i % palette.length],
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
          }),
        );
        if (axis === 1) ring.rotation.x = Math.PI / 2;
        if (axis === 2) ring.rotation.y = Math.PI / 2;
        shell.add(ring);
      }
      shell.traverse((object) => {
        object.raycast = () => {};
      });
      this.groupObjects.add(shell);
      this.groupMeshes.push({ g, shell });
    });
    this.updateGroups();
  }
  updateGroups() {
    for (const { g, shell } of this.groupMeshes || []) {
      const ns = this.nodes.filter((n) => n[this.mode] === g),
        center = new THREE.Vector3();
      ns.forEach((n) => center.add(new THREE.Vector3(n.x, n.y, n.z)));
      center.divideScalar(ns.length);
      let r = 35;
      ns.forEach(
        (n) =>
          (r = Math.max(
            r,
            new THREE.Vector3(n.x, n.y, n.z).distanceTo(center) + 22,
          )),
      );
      shell.position.copy(center);
      shell.scale.setScalar(r);
      shell.visible = ns.some((n) => this.visibleNodes.has(n.id));
    }
    this.labelsDirty = true;
  }
  buildLabels() {
    this.overlay.replaceChildren();
    this.labelElements.clear();
    const add = (key, text, kind, click) => {
      const el = document.createElement(click ? "button" : "span");
      el.className = `annotation ${kind}`;
      el.textContent = text;
      el.dataset.key = key;
      if (click) el.onclick = click;
      this.overlay.append(el);
      this.labelElements.set(key, el);
    };
    this.nodes.forEach((n) =>
      add(n.id, n.label, "node-label", () => this.callbacks.choose(n.id)),
    );
    this.links.forEach((e) => {
      add(e.id, e.relation, "edge-label", () =>
        this.callbacks.selectEdge(e.id),
      );
      const title = `${this.nodeMap.get(sourceId(e)).label} → ${e.relation} → ${this.nodeMap.get(targetId(e)).label}`;
      this.labelElements.get(e.id).title = title;
      this.labelElements.get(e.id).setAttribute("aria-label", title);
    });
    const byPredicate = new Map();
    this.links.forEach((e) => {
      const a = this.nodeMap.get(sourceId(e)),
        b = this.nodeMap.get(targetId(e));
      if (a.section === b.section) return;
      const key = `${a.section}:${e.relation}:${b.section}`;
      if (!byPredicate.has(key)) byPredicate.set(key, []);
      byPredicate.get(key).push(e);
    });
    this.overviewBundles = [...byPredicate.values()]
      .sort((a, b) => b.length - a.length)
      .slice(0, 4)
      .map((edges, i) => ({ key: `bundle-${i}`, edges }));
    this.overviewBundles.forEach((bundle) =>
      add(
        bundle.key,
        `${bundle.edges[0].relation} · ${bundle.edges.length}`,
        "bundle-label",
        () => this.callbacks.selectEdge(bundle.edges[0].id),
      ),
    );
    for (const mode of ["section", "community"]) {
      [...new Set(this.nodes.map((n) => n[mode]))].forEach((g) =>
        add(
          `group-${mode}-${g}`,
          mode === "section" ? g : `Сообщество ${Number(g) + 1}`,
          "group-label",
        ),
      );
    }
  }
  project(point) {
    const vector = new THREE.Vector3(point.x, point.y, point.z).project(
      this.graph.camera(),
    );
    return {
      x: ((vector.x + 1) * this.container.clientWidth) / 2,
      y: ((1 - vector.y) * this.container.clientHeight) / 2,
      z: vector.z,
    };
  }
  drawLabels() {
    const camera = this.graph.camera(),
      distance = this.distance(),
      boxes = [],
      candidates = [];
    this.labelElements.forEach((el) => {
      el.style.visibility = "hidden";
    });
    // Reserve projected node disks, so labels cannot obscure another concept.
    const nodeDisks = this.nodes
      .filter(
        (n) =>
          this.visibleNodes.has(n.id) &&
          (!this.selected || n.id === this.selected || this.nearby.has(n.id)),
      )
      .map((n) => {
        const p = this.project(n),
          r = Math.max(
            5,
            (n.radius /
              camera.position.distanceTo(new THREE.Vector3(n.x, n.y, n.z))) *
              this.container.clientHeight,
          );
        return { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 };
      });
    const place = (key, point, priority, offsets) => {
      const el = this.labelElements.get(key);
      if (!el) return;
      const p = this.project(point);
      if (p.z < -1 || p.z > 1) return;
      candidates.push({ el, p, priority, offsets, key });
    };
    this.nodes.forEach((n) => {
      if (!this.visibleNodes.has(n.id)) return;
      if (
        this.selected &&
        n.id !== this.selected &&
        !this.nearby.has(n.id) &&
        n.id !== this.hovered
      )
        return;
      if (
        !this.selected &&
        distance > 1500 &&
        this.model.graph.degree(n.id) < 5 &&
        n.id !== this.hovered
      )
        return;
      if (
        !this.selected &&
        distance > 950 &&
        this.model.graph.degree(n.id) < 3 &&
        n.id !== this.hovered
      )
        return;
      const priority =
        n.id === this.selected
          ? 1000
          : n.id === this.hovered
            ? 950
            : this.inspection?.second.has(n.id)
              ? 350
              : this.nearby.has(n.id)
                ? 600
                : this.model.graph.degree(n.id) * 10;
      const el = this.labelElements.get(n.id);
      el.classList.toggle("selected", n.id === this.selected);
      const second = this.inspection?.second.has(n.id) || false;
      el.classList.toggle("depth-two", second);
      el.textContent = second ? `${n.label} · 2 шаг` : n.label;
      const projectedRadius = Math.max(
        8,
        ((n.radius * (n.id === this.selected ? 1.7 : 1.2)) /
          camera.position.distanceTo(new THREE.Vector3(n.x, n.y, n.z))) *
          this.container.clientHeight,
      );
      const offset = projectedRadius + 15;
      place(n.id, n, priority, [
        [offset, -10],
        [offset, 14],
        [0, offset],
        [-offset - 90, -10],
        [0, -offset - 45],
        [offset + 25, -30],
      ]);
    });
    const edges = this.links.filter(
      (e) =>
        this.visibleEdges.has(e.id) &&
        (e.id === this.focusedEdge ||
          e.id === this.hoveredEdge ||
          (this.selected && !this.inspection && this.incident(e))),
    );
    edges.forEach((e) => {
      const a = this.nodeMap.get(sourceId(e)),
        b = this.nodeMap.get(targetId(e));
      const mid = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
      };
      place(e.id, mid, e.id === this.focusedEdge ? 900 : 300, [
        [0, -10],
        [0, 25],
        [0, -40],
        [40, 8],
        [-40, 8],
      ]);
    });
    if (this.inspection) {
      for (const bucket of this.inspection.buckets) {
        const p = this.inspectionOrigin
          .clone()
          .add(
            new THREE.Vector3(
              bucket.anchor.x,
              bucket.anchor.y,
              bucket.anchor.z,
            ),
          );
        place(`predicate-${bucket.key}`, p, 750, [
          [0, -10],
          [0, 20],
          [0, -35],
        ]);
      }
    }
    if (!this.selected)
      this.groupMeshes.forEach(({ g, shell }) => {
        const point = shell.position.clone();
        point.y += shell.scale.x + 18;
        const key = `group-${this.mode}-${g}`;
        this.labelElements.get(key).style.color = this.color(
          this.nodes.find((n) => n[this.mode] === g),
        );
        place(key, point, 800, [
          [0, -15],
          [0, -35],
          [0, 10],
        ]);
      });
    if (!this.selected) {
      for (const bundle of this.overviewBundles || []) {
        const actual = bundle.edges.filter((e) => this.visibleEdges.has(e.id));
        if (!actual.length) continue;
        const source = this.nodeMap.get(sourceId(actual[0])),
          target = this.nodeMap.get(targetId(actual[0]));
        this.labelElements.get(bundle.key).textContent =
          `${source.section} → ${target.section}\n${actual[0].relation} · ${actual.length}`;
        this.labelElements.get(bundle.key).title = actual
          .map(
            (e) =>
              `${this.nodeMap.get(sourceId(e)).label} → ${e.relation} → ${this.nodeMap.get(targetId(e)).label}`,
          )
          .join("\n");
        const points = actual.flatMap((e) => [
          this.nodeMap.get(sourceId(e)),
          this.nodeMap.get(targetId(e)),
        ]);
        const midpoint = new THREE.Vector3();
        points.forEach((n) => midpoint.add(new THREE.Vector3(n.x, n.y, n.z)));
        midpoint.divideScalar(points.length);
        place(bundle.key, midpoint, 400, [
          [0, -10],
          [0, 30],
          [0, -45],
        ]);
      }
    }
    const overlaps = (a, b) =>
      a.x < b.x + b.w + 5 &&
      a.x + a.w + 5 > b.x &&
      a.y < b.y + b.h + 4 &&
      a.y + a.h + 4 > b.y;
    candidates.sort((a, b) => b.priority - a.priority);
    for (const { el, p, key, offsets } of candidates) {
      const w = el.offsetWidth,
        h = el.offsetHeight;
      for (const [ox, oy] of offsets) {
        const x =
            p.x +
            ox -
            (el.classList.contains("node-label") && ox > 0 ? 0 : w / 2),
          y = p.y + oy;
        const box = { x, y, w, h };
        if (
          x < 8 ||
          y < 8 ||
          x + w > this.container.clientWidth - 8 ||
          y + h > this.container.clientHeight - 8 ||
          boxes.some((b) => overlaps(box, b)) ||
          nodeDisks.some((b) => overlaps(box, b))
        )
          continue;
        el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
        el.style.visibility = "visible";
        boxes.push({ ...box, key });
        break;
      }
    }
    this.labelBoxes = boxes;
    this.visibleRelationLabels = boxes.filter((b) =>
      this.links.some((e) => e.id === b.key),
    ).length;
  }
  pickNodeAt(event) {
    if (!event || !Number.isFinite(event.clientX)) return null;
    const rect = this.graph.renderer().domElement.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.graph.camera(),
    );
    const objects = this.nodes
      .filter((n) => this.visibleNodes.has(n.id))
      .map((n) => this.meshes.get(n.id)?.group)
      .filter(Boolean);
    const hits = raycaster.intersectObjects(objects, true);
    if (!hits.length) return null;
    let object = hits[0].object;
    while (object && !object.__data) object = object.parent;
    return object?.__data || null;
  }
  setPosition(node, p) {
    node.x = node.fx = p.x;
    node.y = node.fy = p.y;
    node.z = node.fz = p.z;
    node.vx = node.vy = node.vz = 0;
  }
  restoreOverview() {
    cancelAnimationFrame(this.positionFrame);
    this.nodes.forEach((n) =>
      this.setPosition(n, this.layouts[this.mode][n.id]),
    );
    this.inspection = null;
    this.inspectionSignature = null;
    this.overlay.querySelectorAll(".predicate-label").forEach((el) => {
      this.labelElements.delete(el.dataset.key);
      el.remove();
    });
  }
  applyInspection() {
    const signature = JSON.stringify([
      this.selected,
      [...this.nearby].sort(),
      [...this.visibleEdges].sort(),
      this.mode,
    ]);
    if (signature === this.inspectionSignature) return;
    if (!this.selected) {
      if (this.inspection) {
        this.restoreOverview();
        this.graph.cooldownTicks(1).d3ReheatSimulation();
        this.updateGroups();
      }
      return;
    }
    this.restoreOverview();
    this.inspectionSignature = signature;
    this.inspection = createInspection(
      this.model,
      this.selected,
      this.visibleEdges,
      this.nearby,
    );
    const base = this.layouts[this.mode][this.selected];
    this.inspectionOrigin = new THREE.Vector3(base.x, base.y, base.z);
    this.nodes.forEach((n) => {
      const p = this.inspection.positions[n.id];
      if (p)
        this.setPosition(n, {
          x: base.x + p.x,
          y: base.y + p.y,
          z: base.z + p.z,
        });
    });
    for (const bucket of this.inspection.buckets) {
      const el = document.createElement("button");
      el.className = "annotation predicate-label";
      el.dataset.key = `predicate-${bucket.key}`;
      el.textContent = `${bucket.direction === "in" ? "→ " : ""}${bucket.relation}${bucket.direction === "out" ? " →" : ""} · ${bucket.edges.length}`;
      el.title = bucket.edges
        .map((id) => {
          const e = this.model.graph.getEdgeAttributes(id);
          return `${this.model.graph.getNodeAttribute(e.source, "label")} → ${e.relation} → ${this.model.graph.getNodeAttribute(e.target, "label")}`;
        })
        .join("\n");
      el.onclick = () => this.callbacks.selectEdge(bucket.edges[0]);
      this.overlay.append(el);
      this.labelElements.set(el.dataset.key, el);
    }
    this.graph.cooldownTicks(1).d3ReheatSimulation();
    this.stable = true;
  }
  focusInspection(duration = 650) {
    const origin = this.inspectionOrigin.clone(),
      pts = Object.values(this.inspection.positions);
    const maxY = Math.max(80, ...pts.map((p) => Math.abs(p.y))) + 65,
      maxX = Math.max(160, ...pts.map((p) => Math.abs(p.x))) + 180;
    const fov = THREE.MathUtils.degToRad(this.graph.camera().fov),
      aspect = this.container.clientWidth / this.container.clientHeight;
    const distance =
      Math.max(maxY / Math.tan(fov / 2), maxX / (Math.tan(fov / 2) * aspect)) *
      1.18;
    this.graph.cameraPosition(
      origin.clone().add(new THREE.Vector3(0, 0, distance)),
      origin,
      duration,
    );
  }
  distance() {
    return this.graph
      .camera()
      .position.distanceTo(this.graph.controls().target);
  }
  fit(duration = 650) {
    this.graph.cameraPosition({ x: 80, y: 55, z: 880 }, origin, duration);
    const aspect = this.container.clientWidth / this.container.clientHeight;
    if (aspect < 1)
      this.graph.cameraPosition({ x: 80, y: 55, z: 1450 }, origin, duration);
  }
  focus(id, duration = 700) {
    const node = this.nodeMap.get(id);
    if (!node) return;
    if (this.inspection) {
      this.focusInspection(duration);
      return;
    }
    const target = new THREE.Vector3(node.x, node.y, node.z),
      camera = this.graph.camera();
    const direction = camera.position
      .clone()
      .sub(this.graph.controls().target)
      .normalize();
    const distance = 430;
    const position = target.clone().add(direction.multiplyScalar(distance));
    this.graph.cameraPosition(position, target, duration);
  }
  zoom(factor) {
    const target = this.graph.controls().target.clone(),
      offset = this.graph
        .camera()
        .position.clone()
        .sub(target)
        .multiplyScalar(factor);
    if (offset.length() < 110 || offset.length() > 3000) return;
    this.graph.cameraPosition(target.clone().add(offset), target, 350);
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.positionFrame);
    this.resizeObserver.disconnect();
    this.graph._destructor();
  }
}
