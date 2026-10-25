import {
  laboratoryPackage,
  startLaboratory,
  listLaboratories,
  laboratoryPreset,
} from "./registry.js";
import { openLeontievLaboratory } from "./leontiev-view.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const words = {
  P: "Родитель",
  A: "Взрослый",
  C: "Ребёнок",
  left: "Участник 1",
  right: "Участник 2",
  complementary: "Дополнительная",
  crossed: "Пересекающаяся",
  ulterior: "Скрытая · задана гипотезой",
  "insufficient-data": "Скрытый уровень · данных недостаточно",
  "not-represented": "Не представлено",
  unpleasant: "Неприятно",
  neutral: "Нейтрально",
  pleasant: "Приятно",
  low: "Низкое",
  moderate: "Умеренное",
  high: "Высокое",
  hinders: "Мешает цели",
  supports: "Помогает цели",
  irrelevant: "Не затрагивает цель",
  unfavorable: "Неблагоприятный",
  favorable: "Благоприятный",
  controlling: "Контролирующий Родитель",
  nurturing: "Заботливый Родитель",
  adult: "Взрослый: текущая информация",
  free: "Свободный Ребёнок",
  adapted: "Адаптированный Ребёнок",
  valence: "Приятность",
  arousal: "Возбуждение",
  goal: "Влияние на цель",
  control: "Возможность влияния",
  expectation: "Ожидание исхода",
  reportedValence: "Самоописание приятности",
  reportedArousal: "Самоописание возбуждения",
  "clarify-goal": "Уточнить, какая цель затронута",
  "clarify-control": "Уточнить доступные способы влияния",
  "change-conditions": "Рассмотреть изменение условий",
  "request-deadline": "Запросить конкретный срок",
  "use-available-time": "Рассмотреть использование освободившегося времени",
  "seek-support": "Рассмотреть обращение за поддержкой",
  "adapt-plan": "Рассмотреть адаптацию плана",
  "prepare-alternative": "Подготовить альтернативный план",
};
const word = (v) =>
  v === null || v === undefined ? "Не представлено" : (words[v] ?? String(v));
const statuses = {
  "accepted-within-theory": "Положение подхода",
  contested: "Оспариваемое",
  didactic: "Учебная операционализация",
  candidate: "Кандидат · требует проверки",
};
const spanStatuses = {
  reviewed: "Локатор проверен",
  candidate: "Локатор требует проверки",
  didactic: "Фрагмент учебного правила",
};
const spanBasis = {
  "theoretical-text": "Теоретический текст",
  lecture: "Материал лекции",
  "atlas-data": "Данные атласа",
  "project-design": "Проектное учебное правило",
};
const spanNote = (span) =>
  span
    ? `<span class="lab-source-span">${esc(spanBasis[span.basis])} · ${esc(spanStatuses[span.status])}: ${esc(span.locator)}. Это локатор основания, а не подтверждение научной модели.</span>`
    : `<span class="lab-source-span">Точный фрагмент для этого утверждения пока не указан.</span>`;
const evidence = (...ids) =>
  `<div class="lab-citations">${ids.map((id) => `<button type="button" data-claim="${id}" aria-label="Основание ${id}">${active?.claims.get(id)?.status === "didactic" ? "Учебное правило" : (statuses[active?.claims.get(id)?.status] ?? "Утверждение")} ↗</button>`).join("")}</div>`;
const value = (v) => (v === null ? "Не представлено" : v ? "Да" : "Нет");
let active = null;
export const getActiveLaboratory = () => active?.runtime ?? null;
function input(spec, key) {
  const d = spec.inputs[key];
  if (d.type === "boolean")
    return `<label class="lab-check"><input type="checkbox" data-variable="${key}" id="lab-${key}">${esc(d.label)}</label>`;
  return `<label class="lab-field" for="lab-${key}"><span>${esc(d.label)}</span><select id="lab-${key}" data-variable="${key}">${d.nullable ? '<option value="__unknown__">Не задано</option>' : ""}${d.enum.map((v) => `<option value="${v}">${esc(key === "control" ? (v === "high" ? "Есть способы влияния" : "Мало возможностей") : word(v))}</option>`).join("")}</select></label>`;
}
function vectorText(v) {
  return v
    ? `${word(v.sender)} · ${word(v.source)} → ${word(v.receiver)} · ${word(v.target)}`
    : "Уровень не задан";
}
function transactionDiagram(o) {
  const xs = { left: 125, right: 615 },
    ys = { P: 85, A: 205, C: 325 };
  const arrows = [
    ["social-stimulus", o.stimulus, "#246c70", -7, false],
    ["social-response", o.response, "#246c70", 7, false],
    ["psychological-stimulus", o.psychStimulus, "#a6691d", -18, true],
    ["psychological-response", o.psychResponse, "#a6691d", 18, true],
  ];
  const paths = arrows
    .filter(([, v]) => v && v.source !== null && v.target !== null)
    .map(([id, v, color, offset, dashed]) => {
      const direction = xs[v.receiver] > xs[v.sender] ? 1 : -1;
      const x1 = xs[v.sender] + direction * 43,
        x2 = xs[v.receiver] - direction * 43,
        y1 = ys[v.source] + offset,
        y2 = ys[v.target] + offset;
      return `<path data-vector="${id}" data-sender="${v.sender}" data-source="${v.source}" data-receiver="${v.receiver}" data-target="${v.target}" d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" ${dashed ? 'stroke-dasharray="8 5"' : ""} marker-end="url(#lab-arrow-${dashed ? "psych" : "social"})"><title>${esc(id + ": " + vectorText(v))}</title></path>`;
    })
    .join("");
  return `<svg class="lab-transactions-svg" viewBox="0 0 740 395" role="img" aria-label="Два участника: Родитель сверху, Взрослый в центре, Ребёнок снизу. Направленные векторы стимула и ответа."><defs>${["social", "psych"].map((id, i) => `<marker id="lab-arrow-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${i ? "#a6691d" : "#246c70"}"/></marker>`).join("")}</defs>${Object.entries(
    xs,
  )
    .map(
      ([side, x]) =>
        `<text x="${x}" y="22" text-anchor="middle" class="lab-participant">${word(side)}</text>${Object.entries(
          ys,
        )
          .map(
            ([ego, y]) =>
              `<g data-ego="${side}-${ego}"><circle cx="${x}" cy="${y}" r="42" fill="#f7faf7" stroke="#94aaa3"/><text x="${x}" y="${y - 4}" text-anchor="middle" class="lab-ego-letter">${ego}</text><text x="${x}" y="${y + 16}" text-anchor="middle" class="lab-ego-word">${word(ego)}</text></g>`,
          )
          .join("")}`,
    )
    .join(
      "",
    )}${paths}<text x="370" y="382" text-anchor="middle" class="lab-svg-note">Положение кругов постоянно; класс определяется концами векторов.</text></svg>`;
}
function berneResult(o) {
  return `<section class="lab-panel lab-vector-panel"><div class="lab-panel-heading"><h3>Структурная разметка</h3><span class="lab-badge" data-output="kind">${word(o.kind)}</span></div>
 <div class="lab-verdict"><p>Социальный уровень: <strong data-output="socialClass">${word(o.socialClass)}</strong>${o.psychStimulus ? ` · психологический: <strong data-output="psychClass">${word(o.psychClass)}</strong>` : ""}.</p>${o.kind === "insufficient-data" ? '<p class="lab-boundary" data-psych-incomplete>Гипотеза о втором уровне включена, но не все четыре психологических конца заданы. Класс скрытой трансакции не установлен.</p>' : ""}<div class="lab-match-row"><span>Источник ответа: <b data-output="sourceMatch">${o.sourceMatch ? "совпал" : "не совпал"}</b></span><span>Адресат ответа: <b data-output="targetMatch">${o.targetMatch ? "совпал" : "не совпал"}</b></span></div>${evidence("b-reversal", "b-crossed")}</div>
 <div class="lab-line-legend"><span>━━ Социальный уровень</span><span class="psych">┄┄ Психологический · гипотеза</span></div>${transactionDiagram(o)}
 <div class="lab-vector-table"><div><b>Стимул</b><span data-output="stimulus">${esc(vectorText(o.stimulus))}</span></div><div><b>Ожидаемый ответ</b><span data-output="expected">${esc(vectorText(o.expected))}</span></div><div><b>Выбранный ответ</b><span data-output="response">${esc(vectorText(o.response))}</span></div>${o.psychStimulus ? `<div class="psych"><b>Психологический стимул</b><span>${esc(vectorText(o.psychStimulus))}</span></div><div class="psych"><b>Психологический ответ</b><span>${esc(vectorText(o.psychResponse))}</span></div>` : ""}</div>${evidence("b-structural", "b-hidden")}
 <p class="lab-boundary">${esc(active.claims.get("b-no-prediction").text)} ${esc(active.claims.get("b-no-prediction").limitation)}</p>${evidence("b-no-prediction")}</section>`;
}

function affectDiagram(d, baseline) {
  const x = { unpleasant: 95, neutral: 200, pleasant: 305 },
    y = { low: 260, moderate: 155, high: 50 };
  const v = d.point.valence,
    a = d.point.arousal;
  const marker = d.complete
    ? `<circle data-affect-point cx="${x[v]}" cy="${y[a]}" r="9" fill="#24777a" stroke="white" stroke-width="3"/>`
    : v !== null
      ? `<line data-affect-partial x1="${x[v]}" x2="${x[v]}" y1="40" y2="270" stroke="#24777a" stroke-width="4" stroke-dasharray="5 5"/>`
      : a !== null
        ? `<line data-affect-partial x1="80" x2="320" y1="${y[a]}" y2="${y[a]}" stroke="#24777a" stroke-width="4" stroke-dasharray="5 5"/>`
        : "";
  const before =
    baseline &&
    baseline.reportedValence !== null &&
    baseline.reportedArousal !== null
      ? `<circle data-affect-baseline cx="${x[baseline.reportedValence]}" cy="${y[baseline.reportedArousal]}" r="13" fill="none" stroke="#a6691d" stroke-width="2"/>`
      : "";
  return `<svg viewBox="0 0 400 310" class="lab-affect-svg" role="img" aria-label="Описание аффекта: приятность по горизонтали, возбуждение по вертикали. Неизвестные координаты не подставляются."><path d="M70 155 H330 M200 30 V280" stroke="#9baea7"/><path data-ordinal-grid d="M95 50 H305 V260 H95 Z M95 155 H305 M200 50 V260" fill="none" stroke="#dce5df" stroke-dasharray="3 4"/><text x="200" y="17" text-anchor="middle">Высокое возбуждение</text><text x="200" y="302" text-anchor="middle">Низкое возбуждение</text><text x="60" y="150" text-anchor="middle" transform="rotate(-90 60 150)">Неприятно</text><text x="348" y="155" text-anchor="middle" transform="rotate(90 348 155)">Приятно</text>${before}${marker}${!d.complete ? `<rect x="107" y="127" width="186" height="56" rx="6" fill="#fbfdfb" opacity=".96"/><text x="200" y="149" text-anchor="middle" class="lab-unknown">${v === null && a === null ? "Нет самоописания" : "Координата не задана"}</text><text x="200" y="169" text-anchor="middle" class="lab-svg-note">Не представлено ≠ ноль</text>` : ""}</svg>`;
}
function appraisalDiagram(a) {
  const items = [
    ["Цель затронута", a.relevance],
    ["Есть препятствие", a.obstruction],
    ["Доступно влияние", a.canInfluence],
    ["Ожидается затруднение", a.expectedObstacle],
  ];
  return `<div class="lab-appraisal-network" aria-label="Качественный профиль оценки"><div class="lab-fact">Факт: результат задерживается</div><div class="lab-check-nodes">${items.map(([label, v]) => `<div class="lab-appraisal-node ${v === null ? "unknown" : v ? "active" : "inactive"}"><span>${esc(label)}</span><strong>${value(v)}</strong></div>`).join("")}</div><div class="lab-computation-arrow">↓ Учебные варианты действий · не научный прогноз</div><ul class="lab-options" data-output="options">${a.options.length ? a.options.map((x) => `<li data-option="${x}"><span class="lab-didactic-tag">Учебная ветвь</span> ${esc(word(x))}</li>`).join("") : "<li>Для незатронутой цели правило не строит варианты действия.</li>"}</ul></div>`;
}
function emotionResult(o) {
  return `<div class="lab-comparison-grid"><section class="lab-panel"><div class="lab-panel-heading"><h3>Описание аффекта</h3><span class="lab-badge">Russell · измерения</span></div><p class="lab-receives">Получает: самоописание приятности и возбуждения.</p>${affectDiagram(o.dimensions, o.baseline)}<p class="lab-chart-legend">● Сейчас${o.baseline ? " · ◯ Сохранённое условие" : ""}</p><p class="lab-point-caption" data-output="affect-description">${word(o.dimensions.point.valence)} · ${word(o.dimensions.point.arousal)}</p><p class="lab-subtle">${esc(active.claims.get("e-ordinal").text)}</p>${evidence("e-dimensions", "e-ordinal")}<p class="lab-boundary">${esc(active.claims.get("e-no-category").text)}</p>${evidence("e-no-category")}</section>
 <section class="lab-panel"><div class="lab-panel-heading"><h3>Оценка ситуации</h3><span class="lab-badge">Оценочная перспектива</span></div><p class="lab-receives">Получает: влияние на цель, контроль и ожидание.</p>${appraisalDiagram(o.appraisal)}${evidence("e-appraisal", "e-affordance")}<p class="lab-boundary">${esc(active.claims.get("e-affordance").limitation)}</p><p class="lab-subtle">${esc(active.claims.get("e-appraisal").limitation)}</p></section></div>
 <section class="lab-panel lab-counterfactual"><h3>Сравнение с сохранённым условием</h3><div data-output="comparison">${
   o.baseline
     ? `<p>Изменено: <strong>${o.changedFields.length ? o.changedFields.map((v) => esc(word(v))).join(", ") : "условия совпадают"}</strong>.</p><div class="lab-baseline-table">${Object.keys(
         o.baseline,
       )
         .map(
           (k) =>
             `<div class="${o.changedFields.includes(k) ? "changed" : ""}"><span>${esc(word(k))}</span><span>${esc(word(o.baseline[k]))} → ${esc(word(active.runtime.getState().inputs[k]))}</span></div>`,
         )
         .join("")}</div>`
     : "<p>Сохраните условие, затем измените контроль или самоописание. Сравните, какая из двух моделей изменилась.</p>"
 }</div><p class="lab-subtle">${esc(active.claims.get("e-isolation").text)}</p>${evidence("e-isolation", "e-snapshot")}</section>`;
}
function evidencePanel(pkg) {
  return `<details id="lab-evidence" class="lab-details"><summary>Утверждения, статусы и источники</summary><p class="lab-subtle">«Положение подхода» означает принятие внутри указанной теории, а не универсальный научный консенсус.</p>${pkg.claims
    .map(
      (c) =>
        `<article id="lab-claim-${c.id}" class="lab-claim"><div class="lab-claim-meta"><strong>${esc(statuses[c.status])}</strong> · ${esc(pkg.theories.find((t) => t.id === c.theoryId).label)}</div><p>${esc(c.text)}</p><p class="lab-subtle"><b>Область:</b> ${esc(c.scope)}<br><b>Ограничение:</b> ${esc(c.limitation)}</p>${spanNote(c.sourceSpan)}${c.sourceIds
          .map((id) => {
            const s = pkg.sources.find((v) => v.id === id);
            return `<div class="lab-source">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a>` : esc(s.title)}<small>${esc(s.locator)} · ${s.access === "local-only" ? "Локальный оригинал; полный текст не опубликован" : "Публичная ссылка или материал проекта"}</small><small>${esc(s.verification)}</small></div>`;
          })
          .join(
            "",
          )}${c.unknownProvenance ? `<p>Происхождение неизвестно: ${esc(c.unknownProvenance)}</p>` : ""}</article>`,
    )
    .join("")}</details>`;
}
function describeValue(v) {
  if (v === null) return "Не представлено";
  if (typeof v === "boolean") return v ? "Да" : "Нет";
  if (Array.isArray(v))
    return v.length ? v.map(describeValue).join(" · ") : "∅";
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, v]) => `${word(k)}: ${describeValue(v)}`)
      .join("; ");
  return word(v);
}
function traceView(trace) {
  const titles = {
    responder: "Адресат стимула",
    stimulus: "Заданный стимул",
    response: "Заданный ответ",
    expected: "Обратный вектор",
    sourceMatch: "Совпадение источника",
    targetMatch: "Совпадение адресата",
    socialClass: "Класс социального уровня",
    psychKnown: "Психологические концы представлены",
    psychStimulus: "Психологический стимул",
    psychResponse: "Психологический ответ",
    psychExpected: "Ожидаемый психологический ответ",
    psychClass: "Класс психологического уровня",
    kind: "Итог с учётом заданных уровней",
    complete: "Обе координаты представлены",
    missing: "Не представлено",
    relevance: "Цель затронута",
    obstruction: "Препятствие для цели",
    canInfluence: "Возможность влияния",
    expectedObstacle: "Ожидание затруднения",
    options: "Учебные варианты действий · не прогноз",
    changedFields: "Изменённые переменные",
  };
  const rule = (e) =>
    e.adapter
      ? `<section class="lab-trace-adapter"><h4>${e.adapter === "dimensions" ? "Адаптер описания аффекта" : "Адаптер оценки"}</h4><p>Входы: ${esc(describeValue(e.inputs))}</p>${e.rules.map(rule).join("")}</section>`
      : `<div class="lab-trace-rule"><b>${esc(titles[e.rule] ?? e.rule)}</b><span>${esc(describeValue(e.value))}</span>${e.sourceSpan ? spanNote(e.sourceSpan) : ""}${evidence(...e.claimIds)}</div>`;
  const frame = trace.at(-1);
  return `<p class="lab-subtle">Событий после сброса: <strong data-trace-count>${trace.length}</strong>. Последнее: ${esc(frame.event.type === "intervene" ? `${word(frame.event.variable)} → ${word(frame.event.value)}` : frame.event.type === "reset" ? "Сброс / начальные значения" : frame.event.type === "capture" ? "Сохранение условия" : "Смена инициатора")}. Правила ниже исполнены заново, значения взяты из runtime.</p>${frame.evaluations.map(rule).join("")}<details><summary>История вмешательств</summary><ol>${trace.map((t) => `<li>${esc(t.event.type)}${t.event.variable ? ` · ${esc(word(t.event.variable))}: ${esc(word(t.event.value))}` : ""}</li>`).join("")}</ol></details>`;
}
export function openLaboratory(id, { conceptId = "", conceptLabel = "" } = {}) {
  const entry = listLaboratories().find((e) => e.id === id);
  if (!entry) throw Error("Unknown laboratory");
  if (entry.renderer === "leontiev") {
    active?.unsubscribe?.();
    active = {
      id,
      runtime: openLeontievLaboratory(
        id,
        { conceptId, conceptLabel },
        (nextId, runtime) => {
          active = { id: nextId, runtime };
        },
      ),
    };
    return;
  }
  let dialog = document.querySelector("#model-laboratory");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "model-laboratory";
    dialog.setAttribute("aria-labelledby", "lab-title");
    document.body.append(dialog);
  }
  active?.unsubscribe?.();
  const pkg = laboratoryPackage(id),
    spec = pkg.models.find((m) => m.id === id),
    runtime = startLaboratory(id);
  if (entry.renderer === "transactions")
    runtime.reset(laboratoryPreset(conceptId));
  const claims = new Map(pkg.claims.map((c) => [c.id, c]));
  active = { id, runtime, pkg, spec, claims };
  const berne = entry.renderer === "transactions";
  const controls = berne
    ? `<fieldset><legend>Социальный уровень</legend>${["initiator", "stimulusFrom", "stimulusTo", "responseFrom", "responseTo"].map((k) => input(spec, k)).join("")}</fieldset>${input(spec, "hidden")}<fieldset id="lab-psych-controls" hidden><legend>Психологический уровень · гипотеза</legend>${["psychStimulusFrom", "psychStimulusTo", "psychResponseFrom", "psychResponseTo"].map((k) => input(spec, k)).join("")}</fieldset>`
    : `<fieldset><legend>Условия оценки</legend>${["goal", "control", "expectation"].map((k) => input(spec, k)).join("")}</fieldset><fieldset><legend>Самоописание · независимый ввод</legend>${["reportedValence", "reportedArousal"].map((k) => input(spec, k)).join("")}</fieldset>`;
  dialog.innerHTML = `<div class="lab-header"><div><div class="eyebrow">MODEL LABORATORY · ПИЛОТ ${esc(spec.version)}</div><h2 id="lab-title">${esc(spec.label)}</h2><p>${esc(conceptLabel)} · локальное исследование механизма</p></div><button type="button" id="lab-close" aria-label="Вернуться к понятию на карте">×</button></div><div class="lab-body"><div class="lab-intro">${esc(claims.get(berne ? "b-didactic" : "e-scenario-claim").text)}${evidence(berne ? "b-didactic" : "e-scenario-claim")}</div><div class="lab-toolbar"><button type="button" id="lab-reset">Сбросить опыт</button>${berne ? '<button type="button" data-lab-event="swap-roles">Поменять инициатора ↔</button>' : '<button type="button" class="lab-primary" data-lab-event="capture">Сохранить условие для сравнения</button>'}<span id="lab-update-status" role="status" aria-live="polite"></span></div><p id="lab-error" role="alert" hidden></p><div class="lab-layout"><form id="lab-controls">${controls}</form><div id="lab-results"></div></div>${berne ? `<details id="lab-functional" class="lab-details" ${conceptId === "func" ? "open" : ""}><summary>Структурная и функциональная модели: разные вопросы</summary><div class="lab-functional-grid"><section><h3>Структура · происхождение опыта</h3><p>${esc(claims.get("b-structural").text)}</p><p>Родитель → Взрослый → Ребёнок — порядок кругов на рисунке, не стадии развития.</p>${evidence("b-structural")}</section><section><h3>Функция · проявление поведения</h3><p>${esc(claims.get("b-functional").text)}</p><div class="lab-functional-controls">${input(spec, "leftFunction")}${input(spec, "rightFunction")}</div><p class="lab-boundary">${esc(claims.get("b-functional").limitation)}</p>${evidence("b-functional")}</section></div></details>` : ""}<details id="lab-trace" class="lab-details"><summary>Трассировка правил и вмешательств</summary><div id="lab-trace-content"></div></details>${evidencePanel(pkg)}<details class="lab-details"><summary>Область применимости и допущения</summary><p>${esc(spec.validityDomain)}</p><ul>${spec.limitations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${spec.assumptions.map((id) => `<p>${esc(claims.get(id).text)}</p>${evidence(id)}`).join("")}</details></div>`;
  function render() {
    const s = runtime.getState(),
      o = runtime.getObservables();
    dialog.querySelectorAll("[data-variable]").forEach((el) => {
      const v = s.inputs[el.dataset.variable];
      if (el.type === "checkbox") el.checked = v;
      else el.value = v === null ? "__unknown__" : String(v);
    });
    if (berne)
      dialog.querySelector("#lab-psych-controls").hidden = !s.inputs.hidden;
    dialog.querySelector("#lab-results").innerHTML = berne
      ? berneResult(o)
      : emotionResult(o);
    dialog.querySelector("#lab-trace-content").innerHTML = traceView(
      runtime.getTrace(),
    );
    dialog.querySelector("#lab-update-status").textContent = berne
      ? `Результат: ${word(o.kind)}`
      : `Состояние пересчитано · ${o.dimensions.complete ? "самоописание задано" : "самоописание неполное"}`;
  }
  const apply = (fn) => {
    try {
      fn();
      dialog.querySelector("#lab-error").hidden = true;
    } catch (e) {
      const el = dialog.querySelector("#lab-error");
      el.textContent = e.message;
      el.hidden = false;
    }
  };
  active.unsubscribe = runtime.subscribe(render);
  render();
  dialog.onchange = (e) => {
    const el = e.target.closest("[data-variable]");
    if (el)
      apply(() =>
        runtime.intervene(
          el.dataset.variable,
          el.type === "checkbox"
            ? el.checked
            : el.value === "__unknown__"
              ? null
              : el.value,
        ),
      );
  };
  dialog.onsubmit = (e) => e.preventDefault();
  dialog.onclick = (e) => {
    if (e.target.closest("#lab-close")) dialog.close();
    if (e.target.closest("#lab-reset")) apply(() => runtime.reset());
    const event = e.target.closest("[data-lab-event]");
    if (event) apply(() => runtime.step(event.dataset.labEvent));
    const cite = e.target.closest("[data-claim]");
    if (cite) {
      dialog.querySelector("#lab-evidence").open = true;
      const target = dialog.querySelector(`#lab-claim-${cite.dataset.claim}`);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };
  dialog.onclose = () => {
    active?.unsubscribe?.();
    document.querySelector("#open-lab")?.focus();
  };
  dialog.dataset.model = id;
  dialog.dataset.concept = conceptId;
  document.querySelector("#concept-model")?.close();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  dialog.querySelector("#lab-close").focus();
}
