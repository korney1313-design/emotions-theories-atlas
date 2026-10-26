// A reusable grammar for nested mechanism diagrams. Labels, object identities,
// memberships and relation endpoints come from ModelSpec presentation and outputs.
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderNestedMechanism(scene, output) {
  if (scene.kind !== "nested-mechanism")
    throw Error("Unsupported mechanism scene");
  const activeFrame = output[scene.frameOutput];
  const activeItems = output[scene.itemsOutput];
  const resourceId = output[scene.resourceOutput];
  const resource = scene.resources.find((item) => item.id === resourceId);
  if (
    !scene.frames.some((frame) => frame.id === activeFrame) ||
    !resource ||
    !Array.isArray(activeItems) ||
    activeItems.some((id) => !scene.items.some((item) => item.id === id))
  )
    throw Error("Incomplete mechanism presentation");
  const methods = activeItems.map((id) =>
    scene.items.find((item) => item.id === id),
  );
  return `<div class="mechanism-scene" role="group" aria-label="${esc(scene.ariaLabel)}">${scene.frames
    .map((frame) => {
      const selected = frame.id === activeFrame;
      return `<section class="mechanism-activity ${selected ? "is-active" : ""}" data-scene-frame="${esc(frame.id)}" data-active="${selected}">
      <div class="mechanism-activity-heading"><span class="mechanism-layer">${esc(scene.layerLabels.frame)}</span><h3>${esc(frame.label)}</h3><p data-object="motive-${esc(frame.id)}">${esc(frame.motive)}</p></div>
      ${
        selected
          ? `<div class="mechanism-action" data-object="${esc(scene.action.id)}"><div class="mechanism-action-heading"><span class="mechanism-layer">${esc(scene.layerLabels.action)}</span><strong>${esc(scene.action.label)}</strong><span data-object="goal">${esc(scene.action.goal)}</span></div>
        <div class="mechanism-operation-field"><div class="mechanism-resource" data-object="${esc(resource.id)}"><small>${esc(scene.layerLabels.resource)}</small><b>${esc(resource.label)}</b></div><div class="mechanism-operation-list"><span class="mechanism-layer">${esc(scene.layerLabels.items)}</span>${methods.map((method) => `<div class="mechanism-method-row"><span class="mechanism-link" data-relation="affords" data-from="${esc(resource.id)}" data-to="${esc(method.id)}" aria-label="${esc(scene.relationLabels.resourceToMethod)}">→</span><div class="mechanism-method" data-object="${esc(method.id)}" data-role="operation">${esc(method.label)}</div><span class="mechanism-link" data-relation="realizes" data-from="${esc(method.id)}" data-to="${esc(scene.action.id)}" aria-label="${esc(scene.relationLabels.methodToAction)}">↗</span></div>`).join("")}</div></div>
        <p class="mechanism-relation-key">${esc(scene.relationSummary)}</p></div>`
          : `<p class="mechanism-inactive">${esc(scene.inactiveLabel)}</p>`
      }
    </section>`;
    })
    .join("")}</div>`;
}
