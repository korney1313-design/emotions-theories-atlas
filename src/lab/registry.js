import berne from "./packages/berne.json" with { type: "json" };
import emotions from "./packages/emotions.json" with { type: "json" };
import leontiev from "./packages/leontiev.json" with { type: "json" };
import { assertPackage } from "./schema.js";
import { createRuntime } from "./runtime.js";
const packages = {
  berne: assertPackage(berne),
  emotions: assertPackage(emotions),
  leontiev: assertPackage(leontiev),
};
const entries = [
  {
    id: "berne-transactions",
    atlas: "berne",
    renderer: "transactions",
    label: "Лаборатория трансакций",
    conceptIds: [
      "ego",
      "struct",
      "func",
      "parent",
      "adult",
      "child",
      "cp",
      "np",
      "fc",
      "ac",
      "trans",
      "stim",
      "resp",
      "comp",
      "cross",
      "ulterior",
    ],
  },
  {
    id: "emotions-comparison",
    atlas: "emotions",
    renderer: "comparison",
    label: "Лаборатория объяснений",
    conceptIds: [
      "approaches",
      "affect",
      "valence",
      "arousal",
      "appraisal",
      "goals",
      "components",
      "emotion",
    ],
  },
  ...[
    [
      "leontiev-levels",
      "Строение и преобразования",
      [
        "activity",
        "action",
        "operation",
        "motive",
        "goal",
        "conditions",
        "external",
        "internal",
      ],
    ],
    [
      "leontiev-sense",
      "Значение и личностный смысл",
      ["consciousness", "sensory", "meaning", "sense"],
    ],
    [
      "leontiev-emotion",
      "Мотивы и эмоции",
      ["personality", "need", "hierarchy", "emotion", "outcome"],
    ],
  ].map(([id, label, conceptIds]) => ({
    id,
    atlas: "leontiev",
    renderer: "leontiev",
    label,
    conceptIds,
  })),
];
export function listLaboratories() {
  return structuredClone(entries);
}
export function laboratoryForConcept(atlas, id) {
  return structuredClone(
    entries.find((e) => e.atlas === atlas && e.conceptIds.includes(id)) ?? null,
  );
}
export function laboratoryPackage(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw Error(`Unregistered laboratory ${id}`);
  return structuredClone(packages[entry.atlas]);
}
export function startLaboratory(id) {
  return createRuntime(laboratoryPackage(id), id);
}
export function laboratoryPreset(conceptId) {
  return conceptId === "cross"
    ? { responseFrom: "P", responseTo: "C" }
    : conceptId === "ulterior"
      ? { hidden: true }
      : {};
}
