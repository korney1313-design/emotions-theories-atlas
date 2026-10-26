import {
  laboratoryPackage,
  startLaboratory,
  listLaboratories,
} from "./registry.js";
import { renderNestedMechanism } from "./mechanism-scene.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const options = {
  learning: "Освоение материала",
  recognition: "Признание результата",
  paper: "Бумага и ручка",
  digital: "Цифровой редактор",
  success: "Действие выполнено",
  setback: "Действие не завершено",
};
const entries = () =>
  listLaboratories().filter((e) => e.renderer === "leontiev");
export function openLeontievLaboratory(
  initialId,
  { conceptLabel = "" } = {},
  onRuntime = () => {},
) {
  let dialog = document.querySelector("#model-laboratory");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "model-laboratory";
    dialog.setAttribute("aria-labelledby", "lab-title");
    document.body.append(dialog);
  }
  let runtime;
  function display(id) {
    const pkg = laboratoryPackage(id);
    const spec = pkg.models.find((m) => m.id === id);
    runtime = startLaboratory(id);
    onRuntime(id, runtime);
    const p = spec.presentation;
    const claims = new Map(pkg.claims.map((c) => [c.id, c]));
    let previous = null;
    const source = (span) =>
      span
        ? `${span.locator} · ${span.status === "reviewed" ? "локатор сверён" : span.status === "didactic" ? "учебное правило" : "требует проверки"}`
        : "Точный фрагмент требует проверки";
    const claimView = (c) => {
      const s = pkg.sources.find((v) => v.id === c.sourceIds[0]);
      return `<article class="leontiev-claim" id="lab-claim-${esc(c.id)}"><b>${esc(c.status === "didactic" ? "Учебная интерпретация" : c.status === "candidate" ? "Требует проверки" : "Положение теории")}</b><p>${esc(c.text)}</p><small>${esc(c.scope)} ${esc(c.limitation)}</small><p>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a>` : esc(s.title)} · ${esc(source(c.sourceSpan))}</p></article>`;
    };
    dialog.innerHTML = `<div class="lab-header"><div><div class="eyebrow">ТЕОРИЯ ДЕЯТЕЛЬНОСТИ · ПОКАЗ ПРЕПОДАВАТЕЛЯ</div><h2 id="lab-title">${esc(spec.label)}</h2><p>${esc(conceptLabel)} · ${esc(spec.validityDomain)}</p></div><button type="button" id="lab-close" aria-label="Вернуться к карте">×</button></div><div class="lab-body leontiev-body"><nav class="leontiev-tabs" aria-label="Механизмы">${entries()
      .map(
        (e, i) =>
          `<button type="button" data-model="${e.id}" class="${e.id === id ? "active" : ""}">${i + 1}. ${esc(e.label)}</button>`,
      )
      .join(
        "",
      )}</nav><p class="lab-intro">${esc(claims.get(p.introClaimId).text)} <a href="#lab-evidence">Источник и граница вывода ↓</a></p><div class="leontiev-stage" data-mode="${esc(p.mode)}"><form id="lab-controls">${Object.entries(
      spec.inputs,
    )
      .map(
        ([key, def]) =>
          `<label class="lab-field" for="lab-${key}"><span>${esc(def.label)}</span><select id="lab-${key}" data-variable="${key}">${def.enum.map((v) => `<option value="${esc(v)}">${esc(options[v] ?? v)}</option>`).join("")}</select></label>`,
      )
      .join(
        "",
      )}<button type="button" id="lab-reset">Сбросить условия</button><p class="lab-boundary">Условия заданы для учебного сравнения. Интерфейс не выводит реальные мотивы или эмоции.</p></form><div id="lab-results" class="leontiev-results"></div></div><p class="lab-boundary">${esc(p.caption)}</p><details id="lab-trace" class="lab-details"><summary>Трасса правил и изменений</summary><div id="lab-trace-content"></div></details><details id="lab-evidence" class="lab-details"><summary>Научные утверждения, источники и ограничения</summary>${spec.claimIds.map((c) => claimView(claims.get(c))).join("")}<p>${spec.limitations.map(esc).join(" ")}</p><p>«Потребности, мотивы и эмоции» (1971): библиография подтверждена каталогом РГБ; точные фрагменты ещё требуют сверки.</p></details></div>`;
    const render = () => {
      const state = runtime.getState(),
        output = runtime.getObservables();
      dialog.querySelectorAll("[data-variable]").forEach((el) => {
        el.value = state.inputs[el.dataset.variable];
      });
      if (p.visualization?.kind === "nested-mechanism") {
        const scene = p.visualization;
        const changes = previous
          ? Object.keys(state.inputs).filter(
              (key) => previous.inputs[key] !== state.inputs[key],
            )
          : [];
        const beforeMethods = previous?.outputs?.[scene.itemsOutput] ?? [];
        const change = changes.length
          ? changes
              .map(
                (key) =>
                  `${spec.inputs[key].label}: ${options[previous.inputs[key]]} → ${options[state.inputs[key]]}`,
              )
              .join("; ")
          : "Исходный учебный вариант";
        const observation = changes.includes(scene.methodsChangeInput)
          ? `${scene.methodsObservation}: ${beforeMethods.length} → ${output[scene.itemsOutput].length}; ${scene.methodsInvariant}`
          : changes.includes(scene.frameChangeInput)
            ? scene.frameObservation
            : scene.initialObservation;
        dialog.querySelector("#lab-results").innerHTML =
          `${renderNestedMechanism(scene, output)}<div class="mechanism-explanation"><p><b>Что изменили</b><span>${esc(change)}</span></p><p><b>Что наблюдаем</b><span>${esc(observation)}</span></p><p><b>Почему по Леонтьеву</b><span>${esc(claims.get(scene.whyClaimId).text)} <a href="#lab-claim-${esc(scene.whyClaimId)}">Источник ↗</a></span></p><p><b>Граница иллюстрации</b><span>${esc(claims.get(scene.boundaryClaimId).limitation)}</span></p></div>`;
      } else {
        dialog.querySelector("#lab-results").innerHTML = p.columns
          .map(
            (col, i) =>
              `<section class="leontiev-column" data-column="${i}"><h3>${esc(col.title)}</h3>${col.items.map((key) => `<div class="leontiev-item"><span>${esc(p.labels[key])}</span><strong data-output="${key}">${esc(output[key])}</strong></div>`).join("")}</section>`,
          )
          .join('<div class="leontiev-arrow" aria-hidden="true">→</div>');
      }
      const trace = runtime.getTrace();
      dialog.querySelector("#lab-trace-content").innerHTML =
        `<p>Шагов после сброса: ${trace.length - 1}. Правила вычислены из заданных параметров.</p>${trace
          .at(-1)
          .evaluations.map(
            (e) =>
              `<div class="lab-trace-rule"><b>${esc(e.rule)}</b><span>${esc(e.value)}</span><small>${esc(source(e.sourceSpan))}</small><span>${e.claimIds.map((cid) => `<a href="#lab-claim-${esc(cid)}">${esc(cid)}</a>`).join(" · ")}</span></div>`,
          )
          .join("")}`;
    };
    render();
    dialog.onchange = (event) => {
      const el = event.target.closest("[data-variable]");
      if (el) {
        previous = {
          inputs: runtime.getState().inputs,
          outputs: runtime.getObservables(),
        };
        runtime.intervene(el.dataset.variable, el.value);
      }
      render();
    };
    dialog.onclick = (event) => {
      if (event.target.closest("#lab-close")) dialog.close();
      if (event.target.closest("#lab-reset")) {
        previous = {
          inputs: runtime.getState().inputs,
          outputs: runtime.getObservables(),
        };
        runtime.reset();
      }
      const tab = event.target.closest("[data-model]");
      if (tab && tab.dataset.model !== id) {
        display(tab.dataset.model);
        return;
      }
      render();
    };
    dialog.onsubmit = (event) => event.preventDefault();
    dialog.dataset.model = id;
    dialog.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector("#lab-close").focus();
  }
  display(initialId);
  return runtime;
}
