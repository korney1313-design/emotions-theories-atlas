import "./lab/lab.css";
import { laboratoryForConcept } from "./lab/registry.js";
import { openLaboratory, getActiveLaboratory } from "./lab/view.js";
import { openConceptModel, ensureModelDialog } from "./content-models.js";
import { createModel, palette, layoutFingerprint } from "./model.js";
import { AtlasScene } from "./scene.js";
import "./style.css";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const atlasId =
  new URLSearchParams(location.search).get("atlas") === "emotions"
    ? "emotions"
    : "berne";
const isEmotions = atlasId === "emotions";
const directionExplanation = isEmotions
  ? "Направление и тип — содержательная нормализация лекции; положение подхода не равно установленному факту."
  : "Направления интерпретируются по Source → Target CSV; GEXF ненаправленный.";
const provenanceLabel = (p) =>
  isEmotions
    ? `Лекция · слайды ${p.slides?.join(", ") || p.row}`
    : `${p.file}:${p.row}`;
$("#app").innerHTML =
  `<header><a class="brand" href="/">◈ <strong>KNOWLEDGE ATLAS</strong></a><span>Психология / Эрик Берн</span><span class="local">● Локальная библиотека</span></header><main><aside class="library"><div class="eyebrow">ПРОСТРАНСТВО ЗНАНИЙ / 3D</div><h1>Транзактный<br>анализ</h1><p class="sub">От структуры личности<br>к смыслу взаимодействия</p><label class="search">⌕ <input id="search" type="search" placeholder="Найти понятие…" aria-label="Поиск понятий"><kbd>/</kbd></label><div id="results" aria-live="polite"></div><div class="label">ОРГАНИЗАЦИЯ КАРТЫ</div><div class="segmented"><button id="sections" class="active">Разделы</button><button id="communities">Сообщества</button></div><p id="group-note" class="hint">Содержательная классификация исходной сети</p><div id="legend"></div><details open><summary>Отношения <span id="edge-total"></span></summary><div id="filters"></div><label class="label">Тип отношения<select id="relation" aria-label="Тип отношения"><option value="">Все типы</option></select></label></details><div class="library-bottom"><button id="about">ⓘ О данных и методе</button><p>Экспериментальная сеть · 37 понятий<br>Источник сохранён в проекте</p></div></aside><section class="workspace"><div class="map-top"><div><span class="eyebrow" id="view-title">ОБЩАЯ 3D-КАРТА</span><p id="status" aria-live="polite">Загрузка сети…</p></div><button id="home">↗ Вся карта</button></div><div id="graph" aria-label="Интерактивная карта понятий"></div><div id="semantic-guide" hidden><span>Входящие →</span><strong>Понятие</strong><span>→ Исходящие</span><small>Соседи сгруппированы по отношению · второй шаг уходит в глубину</small></div><div id="annotations" aria-label="Подписи трёхмерной карты"></div><div class="scene-tools"><span class="dimension-badge">3D</span><span id="layout-state">Расчёт пространства…</span><button id="save-layout" title="Скачать координаты обеих группировок">↓ Координаты</button></div><div id="breadcrumbs" aria-label="История исследования"></div><div class="map-bottom"><span id="level">Общая карта</span><span class="map-help">Мышь — вращение · Колесо — масштаб · ПКМ — сдвиг</span><div class="zoom"><button id="out" aria-label="Уменьшить">−</button><button id="fit" aria-label="Вписать карту">⊡</button><button id="in" aria-label="Увеличить">+</button></div></div></section><aside id="card" class="card"></aside></main><dialog id="info"><button id="close-info" class="close" aria-label="Закрыть">×</button><div class="eyebrow">ОБ ЭТОМ АТЛАСЕ</div><h2>Карта — способ задавать вопросы</h2><p>Найденная экспериментальная сеть: 37 понятий и 59 отношений. Учебная модель; библиографические ссылки и страницы в исходниках отсутствуют.</p><p>CSV и GEXF совпадают по понятиям и тройкам отношений. GEXF объявляет рёбра ненаправленными. Стрелки рабочей модели интерпретируют порядок Source → Target из CSV.</p><p>Разделы взяты из исходных данных. Сообщества Louvain вычислены по структуре связей и не равнозначны разделам теории. d3-force-3d рассчитывает реальные координаты x, y, z. Группирующие силы разделяют области, столкновения предотвращаются физической моделью. Координаты сохраняются в этом браузере. PageRank определяет размер узла и характеризует только положение в этой сети.</p><p><a href="https://live.yworks.com/demos/showcase/knowledge-graphs/" target="_blank" rel="noreferrer">Референс взаимодействия: yWorks</a> · Three.js / 3d-force-graph / Graphology</p></dialog>`;

try {
  const response = await fetch(
    isEmotions ? "/atlases/emotions.json" : "/atlas.json",
  );
  if (!response.ok)
    throw new Error("Не удалось загрузить семантическую модель");
  const data = await response.json();
  const picker = document.createElement("label");
  picker.className = "atlas-picker";
  picker.innerHTML =
    '<span>АТЛАС</span><select id="atlas-picker" aria-label="Выбрать атлас"><option value="berne">Транзактный анализ · Берн</option><option value="emotions">Психология эмоций · лекция</option></select>';
  document.querySelector(".library").prepend(picker);
  picker.querySelector("select").value = atlasId;
  picker.querySelector("select").onchange = (e) => {
    location.href = `/?atlas=${e.target.value}`;
  };
  if (isEmotions) {
    document.title = "Knowledge Atlas · Психология эмоций";
    document.querySelector(".library h1").innerHTML = "Психология<br>эмоций";
    document.querySelector(".library .sub").textContent =
      "Объяснения, аргументы и границы научного вывода";
    document.querySelector("header>span").textContent = "Психология / Эмоции";
    document.querySelector(".library-bottom p").innerHTML =
      `${data.nodes.length} понятий · ${data.edges.length} отношений<br>39 слайдов и заметки преподавателя`;
    document.querySelector("#info").innerHTML =
      `<button id="close-info" class="close" aria-label="Закрыть">×</button><div class="eyebrow">ПСИХОЛОГИЯ ЭМОЦИЙ</div><h2>От вопроса к ограниченному выводу</h2><p>${esc(data.provenance.summary)}</p><p>${esc(data.provenance.bibliography)}</p><p>Разделы отражают содержательную организацию лекции. Louvain — другая группировка по сети. PageRank характеризует только положение в этой сети. Координаты не являются научно измеренной близостью. ${esc(directionExplanation)}</p><p>Выбор понятия открывает интерактивную модель; вернуться к связям можно крестиком или Escape.</p>`;
    ensureModelDialog();
  }
  const model = createModel(data),
    { graph } = model;
  let selected = null,
    mode = "section",
    groupFilter = null,
    expanded = false,
    history = [],
    historyIndex = -1,
    relation = "",
    focusedEdge = null;
  let nearby = new Set(),
    visibleEdges = new Set(),
    visibleNodes = new Set();
  const statuses = new Set(data.edges.map((e) => e.status)),
    activeStatuses = new Set(statuses);
  const edgeAllowed = (e) =>
    activeStatuses.has(graph.getEdgeAttribute(e, "status")) &&
    (!relation || graph.getEdgeAttribute(e, "relation") === relation);
  const nodeAllowed = (id) =>
    groupFilter === null ||
    String(graph.getNodeAttribute(id, mode)) === String(groupFilter) ||
    id === selected;
  const neighbors = (id) =>
    graph
      .neighbors(id)
      .filter((n) => nodeAllowed(n) && graph.edges(id, n).some(edgeAllowed));
  let scene;
  scene = new AtlasScene(
    $("#graph"),
    $("#annotations"),
    model,
    layoutFingerprint(data),
    {
      choose,
      selectEdge,
      background: () => {
        if (focusedEdge) {
          focusedEdge = null;
          update();
        }
      },
      stable: (saved) => {
        $("#layout-state").textContent = saved
          ? "Позиции сохранены"
          : "Стабильно · сохранение недоступно";
      },
      moving: () => {
        $("#layout-state").textContent = "Перестройка пространства…";
      },
      level: (distance) => {
        $("#level").textContent =
          distance > 1500
            ? "Обзор областей"
            : distance > 950
              ? "Общая 3D-карта"
              : distance > 550
                ? "Группы понятий"
                : "Детали и отношения";
      },
    },
  );
  $("#layout-state").textContent = scene.storageAvailable
    ? "Позиции сохранены"
    : "Стабильно · сохранение недоступно";
  function renderLegend() {
    const groups = [...new Set(graph.mapNodes((id, a) => a[mode]))];
    $("#legend").innerHTML = groups
      .map(
        (g, i) =>
          `<button class="legend-item ${String(groupFilter) === String(g) ? "chosen" : ""}" data-group="${esc(g)}"><i style="background:${palette[i % palette.length]}"></i><span>${esc(mode === "section" ? g : `Сообщество ${Number(g) + 1}`)}</span><small>${graph.filterNodes((id, a) => a[mode] === g).length}</small></button>`,
      )
      .join("");
    $("#legend")
      .querySelectorAll("[data-group]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            groupFilter =
              String(groupFilter) === button.dataset.group
                ? null
                : button.dataset.group;
            update();
            renderLegend();
          }),
      );
  }
  $("#filters").innerHTML = [...statuses]
    .map(
      (status) =>
        `<label class="filter"><input type="checkbox" value="${status}" checked>${status[0].toUpperCase() + status.slice(1)}<small>${data.edges.filter((e) => e.status === status).length}</small></label>`,
    )
    .join("");
  $("#filters").onchange = (event) => {
    event.target.checked
      ? activeStatuses.add(event.target.value)
      : activeStatuses.delete(event.target.value);
    update();
  };
  [...new Set(data.edges.map((e) => e.relation))]
    .sort()
    .forEach((r) => $("#relation").add(new Option(r, r)));
  $("#relation").onchange = (event) => {
    relation = event.target.value;
    update();
  };
  function update() {
    nearby = new Set(selected ? neighbors(selected) : []);
    if (expanded)
      [...nearby].forEach((n) =>
        neighbors(n).forEach((id) => {
          if (id !== selected) nearby.add(id);
        }),
      );
    visibleNodes = new Set(graph.filterNodes(nodeAllowed));
    visibleEdges = new Set(
      graph.filterEdges(
        (id, a, s, t) => edgeAllowed(id) && nodeAllowed(s) && nodeAllowed(t),
      ),
    );
    if (focusedEdge && !visibleEdges.has(focusedEdge)) focusedEdge = null;
    scene.update({ selected, nearby, visibleNodes, visibleEdges, focusedEdge });
    $("#status").textContent =
      `${visibleNodes.size} понятий · ${visibleEdges.size} отношений`;
    $("#view-title").textContent = selected
      ? "ИССЛЕДОВАНИЕ В 3D"
      : "ОБЩАЯ 3D-КАРТА";
    $("#edge-total").textContent = visibleEdges.size;
    const guide = $("#semantic-guide");
    guide.hidden = !selected;
    if (selected) {
      guide.querySelector("strong").textContent = graph.getNodeAttribute(
        selected,
        "label",
      );
      const incoming = [...visibleEdges].filter(
        (id) => graph.target(id) === selected,
      ).length;
      const outgoing = [...visibleEdges].filter(
        (id) => graph.source(id) === selected,
      ).length;
      guide.querySelectorAll("span")[0].textContent = `Входящие: ${incoming} →`;
      guide.querySelectorAll("span")[1].textContent =
        `→ Исходящие: ${outgoing}`;
      guide.querySelector("small").textContent =
        "Временная раскладка: направление → тип отношения · второй шаг — в глубине";
    }
    renderCard();
    $("#breadcrumbs").innerHTML = history
      .map(
        (id, index) =>
          `<button data-history="${index}" class="${index === historyIndex ? "current" : ""}">${esc(graph.getNodeAttribute(id, "label"))}</button>`,
      )
      .join("<span>›</span>");
    $("#breadcrumbs")
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => goHistory(Number(b.dataset.history))));
  }
  function choose(id, push = true) {
    selected = id;
    expanded = false;
    focusedEdge = null;
    if (
      groupFilter !== null &&
      String(graph.getNodeAttribute(id, mode)) !== String(groupFilter)
    ) {
      groupFilter = null;
      renderLegend();
    }
    if (push) {
      history = history.slice(0, historyIndex + 1);
      history.push(id);
      historyIndex = history.length - 1;
    }
    update();
    scene.focus(id);
    if (isEmotions) openConceptModel(graph.getNodeAttributes(id), data);
    $("#search").value = "";
    $("#results").replaceChildren();
  }
  function goHistory(index) {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    choose(history[index], false);
  }
  function overview() {
    selected = null;
    expanded = false;
    focusedEdge = null;
    groupFilter = null;
    update();
    renderLegend();
    scene.fit();
  }
  function selectEdge(id) {
    if (!graph.hasEdge(id)) return;
    if (!selected || !graph.extremities(id).includes(selected))
      choose(graph.source(id));
    focusedEdge = id;
    update();
    $("#edge-inspector")?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }
  function fitNeighborhood() {
    scene.focusInspection();
  }
  function renderCard() {
    if (!selected) {
      $("#card").innerHTML =
        `<div class="eyebrow">ПУТЕВОДИТЕЛЬ / 3D</div><h2>Как устроена<br>теория?</h2><p class="sub">${mode === "section" ? "Области показывают разделы теории." : "Области показывают сообщества Louvain, а не разделы теории."} Межраздельные подписи называют источник, цель, отношение и число связей. Выберите понятие: его окружение раскроется по направлениям и типам отношений.</p><div class="guide-visual"><span class="orbit-icon">◌</span><span>↗</span>◉</div><div class="label">ТОЧКИ ВХОДА</div>${(data.entryPoints || ["ego", "adult", "trans", "games", "time"]).map((id) => `<button class="entry" data-node="${id}">${esc(graph.getNodeAttribute(id, "label"))}<span>↗</span></button>`).join("")}<div class="note"><b>Цвет</b> — ${mode === "section" ? "теоретический раздел" : "сообщество Louvain"}.<br><b>Размер</b> — PageRank в этой сети.<br><b>Стрелка</b> — ${isEmotions ? "направление отношения лекции" : "направление по CSV"}.<br><br>ЛКМ + движение — вращение.<br>ПКМ + движение — сдвиг.<br>Колесо — приближение.<br>Названия появляются по мере приближения. Наведите на узел для подсказки.</div>`;
    } else {
      const node = graph.getNodeAttributes(selected),
        edges = graph.edges(selected).filter((e) => visibleEdges.has(e));
      const edge = focusedEdge ? graph.getEdgeAttributes(focusedEdge) : null;
      $("#card").innerHTML =
        `<div class="card-nav"><button id="back" ${historyIndex <= 0 ? "disabled" : ""}>← Назад</button><button id="forward" ${historyIndex >= history.length - 1 ? "disabled" : ""} aria-label="Вперёд">→</button><button id="clear" aria-label="Закрыть понятие">×</button></div><div class="eyebrow">${esc(node.section)}</div><h2>${esc(node.label)}</h2><p class="definition">${esc(node.definition)}</p>${isEmotions ? `<p class="concept-kind">${esc(node.kind)}</p><button id="open-model" class="primary">Открыть интерактивную модель ↗</button><p class="hint">${esc(node.limit)}</p>` : ""}${laboratoryForConcept(atlasId, selected) ? `<button id="open-lab" class="lab-card-entry">${esc(laboratoryForConcept(atlasId, selected).label)} ↗</button>` : ""}<div class="metrics"><span><strong>${graph.degree(selected)}</strong> связей</span><span><strong>${node.pagerank.toFixed(3)}</strong> PageRank</span></div><p class="hint">PageRank — положение в этой сети, не теоретическая значимость.</p><div class="depth-control"><button id="expand" class="primary">${expanded ? "Глубина 2 · свернуть до 1 шага" : "Глубина 1 · раскрыть 2-й шаг"}</button><button id="fit-neighbors" class="secondary">Все соседи в кадре ↗</button></div>${edge ? `<section id="edge-inspector"><div class="eyebrow">ВЫБРАННОЕ ОТНОШЕНИЕ</div><p><strong>${esc(graph.getNodeAttribute(graph.source(focusedEdge), "label"))}</strong><br><span>↓ ${esc(edge.relation)}</span><br><strong>${esc(graph.getNodeAttribute(graph.target(focusedEdge), "label"))}</strong></p><small>${esc(edge.status)} · ${esc(provenanceLabel(edge.provenance))}</small><p class="hint">${esc(directionExplanation)}</p></section>` : ""}<div class="label">ОТНОШЕНИЯ · ${edges.length}</div><p class="hint">Нажмите тип связи для подробностей, понятие — для перехода. На карте одинаковые отношения объединены подписью с числом связей. Слева — источники входящих, справа — цели исходящих.</p><div id="relations">${
          edges.length
            ? edges
                .map((id) => {
                  const e = graph.getEdgeAttributes(id),
                    source = graph.source(id),
                    target = graph.target(id),
                    other = source === selected ? target : source;
                  return `<div class="relation ${focusedEdge === id ? "is-focused" : ""}" data-edge-row="${id}"><button class="relation-type" data-edge="${id}">${source === selected ? "↗ Исходящее" : "↙ Входящее"} · ${esc(e.relation)}</button><div class="triple">${esc(graph.getNodeAttribute(source, "label"))} → ${esc(graph.getNodeAttribute(target, "label"))}</div><button class="neighbor-link" data-node="${other}">${esc(graph.getNodeAttribute(other, "label"))} ↗</button><small>${esc(e.status)} · ${esc(provenanceLabel(e.provenance))}</small></div>`;
                })
                .join("")
            : '<p class="hint">Отношения скрыты фильтрами. Измените тип или статус в левой панели.</p>'
        }</div><details><summary>Происхождение и анализ</summary><p class="hint">${esc(provenanceLabel(node.provenance))}.<br>Сообщество Louvain: ${node.community + 1}.<br>${esc(directionExplanation)}<br>${isEmotions ? "Источники и полные заметки доступны в интерактивной модели." : "Страницы первоисточников не указаны."}</p></details>`;
      if (isEmotions)
        $("#open-model").onclick = () => openConceptModel(node, data);
      const laboratory = laboratoryForConcept(atlasId, selected);
      if (laboratory)
        $("#open-lab").onclick = () =>
          openLaboratory(laboratory.id, {
            conceptId: selected,
            conceptLabel: node.label,
          });
      $("#back").onclick = () => goHistory(historyIndex - 1);
      $("#forward").onclick = () => goHistory(historyIndex + 1);
      $("#clear").onclick = overview;
      $("#expand").onclick = () => {
        expanded = !expanded;
        update();
        if (expanded) fitNeighborhood();
        else scene.focus(selected);
      };
      $("#fit-neighbors").onclick = fitNeighborhood;
      $("#card")
        .querySelectorAll("[data-edge]")
        .forEach((b) => (b.onclick = () => selectEdge(b.dataset.edge)));
    }
    $("#card")
      .querySelectorAll("[data-node]")
      .forEach((b) => (b.onclick = () => choose(b.dataset.node)));
  }
  function changeMode(next) {
    if (next === mode) return;
    mode = next;
    groupFilter = null;
    scene.setMode(mode);
    $("#sections").classList.toggle("active", mode === "section");
    $("#communities").classList.toggle("active", mode === "community");
    $("#group-note").textContent =
      mode === "section"
        ? "Содержательная классификация исходной сети"
        : "Louvain · сообщества по структуре связей";
    renderLegend();
    update();
    // Keep the selected concept and follow it when its new physical location settles.
    clearTimeout(scene.focusTimeout);
    scene.focusTimeout = setTimeout(() => {
      if (selected) scene.focus(selected);
      else scene.fit();
    }, 2100);
  }
  $("#sections").onclick = () => changeMode("section");
  $("#communities").onclick = () => changeMode("community");
  $("#home").onclick = overview;
  $("#fit").onclick = overview;
  $("#in").onclick = () => scene.zoom(0.75);
  $("#out").onclick = () => scene.zoom(1.35);
  $("#search").oninput = (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("ru"),
      matches = query
        ? data.nodes.filter((n) =>
            `${n.label} ${n.definition}`
              .toLocaleLowerCase("ru")
              .includes(query),
          )
        : [];
    $("#results").innerHTML = query
      ? matches.length
        ? matches
            .map(
              (n) =>
                `<button data-result="${n.id}">${esc(n.label)}<small>${esc(n.section)}</small></button>`,
            )
            .join("")
        : "<p>Ничего не найдено</p>"
      : "";
    $("#results")
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => choose(b.dataset.result)));
  };
  $("#search").onkeydown = (event) => {
    if (event.key === "Enter") $("#results button")?.click();
    if (event.key === "Escape") {
      $("#search").value = "";
      $("#results").replaceChildren();
    }
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !["INPUT", "SELECT"].includes(document.activeElement.tagName)
    ) {
      event.preventDefault();
      $("#search").focus();
    }
    if (
      event.key === "Escape" &&
      !$("#info").open &&
      !document.querySelector("#concept-model")?.open &&
      !document.querySelector("#model-laboratory")?.open
    )
      overview();
  });
  $("#about").onclick = () => $("#info").showModal();
  $("#close-info").onclick = () => $("#info").close();
  $("#save-layout").onclick = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "knowledge-atlas-3d-layout",
            fingerprint: layoutFingerprint(data),
            layouts: scene.layouts,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "knowledge-atlas-3d-coordinates.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  renderLegend();
  update();
  window.atlas = {
    graph,
    scene,
    data,
    laboratory: getActiveLaboratory,
    getState: () => ({
      selected,
      mode,
      expanded,
      focusedEdge,
      nearby: [...nearby],
      visibleNodes: [...visibleNodes],
      visibleEdges: [...visibleEdges],
      historyIndex,
      activeStatuses: [...activeStatuses],
      relation,
      stable: scene.stable,
    }),
  };
  if (import.meta.hot) import.meta.hot.dispose(() => scene.dispose());
} catch (error) {
  $("#status").textContent = "Ошибка загрузки 3D";
  $("#card").innerHTML =
    `<h2>Не удалось открыть пространство</h2><p>${esc(error.message)}</p><p>Для работы необходим браузер с WebGL2.</p><button onclick="location.reload()">Повторить</button>`;
  console.error(error);
}
