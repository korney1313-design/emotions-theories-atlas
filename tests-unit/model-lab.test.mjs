import test from "node:test";
import assert from "node:assert/strict";
import {
  laboratoryPackage,
  startLaboratory,
  laboratoryForConcept,
} from "../src/lab/registry.js";
import { validatePackage } from "../src/lab/schema.js";
import { createRuntime } from "../src/lab/runtime.js";
import { evaluate } from "../src/lab/expression.js";

const bp = () => laboratoryPackage("berne-transactions");
const ep = () => laboratoryPackage("emotions-comparison");
const lp = () => laboratoryPackage("leontiev-levels");
test("Leontiev package keeps scientific claims, reviewed locators and unverified 1971 distinct", () => {
  const p = lp();
  assert.equal(validatePackage(p).valid, true);
  assert.equal(p.models.length, 3);
  assert.ok(p.claims.some((c) => c.sourceSpan?.status === "reviewed"));
  assert.ok(
    p.sources
      .find((s) => s.id === "l-1971")
      .verification.includes("не сверены"),
  );
  assert.ok(!p.claims.some((c) => c.sourceSpan?.sourceId === "l-1971"));
  assert.ok(
    p.models.every(
      (m) => m.engine === "rules-v1" && m.presentation.columns.length === 3,
    ),
  );
});
test("Leontiev interventions change only stipulated educational context", () => {
  const levels = startLaboratory("leontiev-levels");
  const first = levels.getObservables();
  levels.intervene("conditions", "digital");
  const changed = levels.getObservables();
  assert.equal(changed.motive, first.motive);
  assert.equal(changed.action, first.action);
  assert.notEqual(changed.operation, first.operation);
  levels.intervene("motiveContext", "recognition");
  assert.equal(levels.getObservables().operation, changed.operation);
  assert.notEqual(levels.getObservables().activity, changed.activity);
  const sense = startLaboratory("leontiev-sense");
  const before = sense.getObservables();
  sense.intervene("motiveContext", "recognition");
  assert.equal(sense.getObservables().meaning, before.meaning);
  assert.notEqual(sense.getObservables().sense, before.sense);
  const emotion = startLaboratory("leontiev-emotion");
  const e0 = emotion.getObservables();
  emotion.intervene("motiveContext", "recognition");
  assert.equal(emotion.getObservables().result, e0.result);
  assert.notEqual(emotion.getObservables().relation, e0.relation);
  assert.match(emotion.getObservables().signal, /не задаёт эмоцию/);
  assert.ok(
    emotion
      .getTrace()
      .at(-1)
      .evaluations.every((r) => r.claimIds.length > 0),
  );
});
test("Leontiev nested scene changes operation identities and dependencies while preserving action and goal", () => {
  const p = lp();
  const model = p.models.find((m) => m.id === "leontiev-levels");
  const scene = model.presentation.visualization;
  assert.equal(scene.kind, "nested-mechanism");
  const runtime = startLaboratory("leontiev-levels");
  const before = runtime.getObservables();
  assert.deepEqual(before.activeMethods, ["margin-notes", "paper-cards"]);
  assert.equal(before.activeResource, "paper-tools");
  runtime.intervene("conditions", "digital");
  const after = runtime.getObservables();
  assert.deepEqual(after.activeMethods, [
    "digital-highlight",
    "digital-blocks",
    "digital-outline",
  ]);
  assert.equal(after.activeResource, "digital-tools");
  assert.equal(after.action, before.action);
  assert.equal(after.goal, before.goal);
  assert.equal(after.motive, before.motive);
  runtime.intervene("motiveContext", "recognition");
  const withNewMotive = runtime.getObservables();
  assert.equal(withNewMotive.activeActivity, "recognition");
  assert.deepEqual(withNewMotive.activeMethods, after.activeMethods);
  assert.equal(withNewMotive.goal, before.goal);
  assert.ok(
    p.claims.find((c) => c.id === "l-ways-example").status === "didactic",
  );
  assert.ok(
    model.rules.find((r) => r.id === "activeWays").sourceSpan.status ===
      "didactic",
  );
  for (const id of after.activeMethods)
    assert.ok(scene.items.some((item) => item.id === id));
});
test("packages validate, term senses retain theory context and relations retain n-ary roles", () => {
  for (const p of [bp(), ep()]) assert.equal(validatePackage(p).valid, true);
  const senses = ep().concepts.filter((c) => c.term === "Эмоция");
  assert.equal(senses.length, 2);
  assert.notEqual(senses[0].theoryId, senses[1].theoryId);
  assert.equal(bp().relations[0].roles.length, 3);
  for (const p of [bp(), ep()])
    for (const c of p.claims) {
      assert.ok(c.scope && c.limitation);
      assert.ok(c.sourceIds.length || c.unknownProvenance);
      assert.ok(c.status);
    }
});
test("validator rejects broken sources, theory, rule references, operators, versions and adapters", () => {
  for (const mutate of [
    (p) => (p.claims[0].sourceIds = ["absent"]),
    (p) => (p.claims[0].theoryId = "absent"),
    (p) => (p.models[0].rules[0].expr = { ref: "input.absent" }),
    (p) => (p.models[0].rules[0].expr = { op: "eval", args: ["danger"] }),
    (p) => (p.versions[0].version = "2.0.0"),
    (p) => (p.models[0].inputs.initiator.initial = "bad"),
    (p) => (p.claims[0].roles = null),
  ]) {
    const p = bp();
    mutate(p);
    assert.equal(validatePackage(p).valid, false);
  }
  const p = ep();
  p.adapters[0].mapping.valence = "control";
  assert.equal(validatePackage(p).valid, false);
  const q = ep();
  q.adapters[0].theoryId = "appraisal-qualitative";
  assert.equal(validatePackage(q).valid, false);
  assert.equal(
    validatePackage({ schemaVersion: "model-package/0.1" }).valid,
    false,
  );
});
test("unknown provenance must be explicit and cannot be silently accepted", () => {
  const p = bp();
  p.claims[0].sourceIds = [];
  assert.equal(validatePackage(p).valid, false);
  p.claims[0].unknownProvenance =
    "Страница исходного определения не установлена.";
  p.claims[0].status = "candidate";
  assert.equal(validatePackage(p).valid, true);
});
test("source spans identify a listed source, locator, basis and review status", () => {
  for (const p of [bp(), ep()]) {
    assert.equal(validatePackage(p).valid, true);
    assert.ok(p.claims.some((c) => c.sourceSpan?.status === "didactic"));
    assert.ok(p.models.some((m) => m.rules.some((r) => r.sourceSpan)));
  }
  const valid = bp().claims.find((c) => c.sourceSpan).sourceSpan;
  for (const span of [
    null,
    { ...valid, sourceId: "absent" },
    { ...valid, sourceId: "b-overview" },
    { ...valid, locator: "" },
    { ...valid, locator: "line 1\nsecret text" },
    { ...valid, basis: "experiment" },
    { ...valid, status: "verified-science" },
    { ...valid, excerpt: "unreviewed material" },
  ]) {
    const p = bp();
    p.claims.find((c) => c.sourceSpan).sourceSpan = span;
    assert.equal(validatePackage(p).valid, false);
  }
  const p = ep();
  p.models
    .find((m) => m.id === "emotions-appraisal")
    .rules.find((r) => r.sourceSpan).sourceSpan.sourceId = "e-russell";
  assert.equal(validatePackage(p).valid, false);
});
test("all 81 structural stimulus/response pairs: endpoints determine class, not drawn geometry", () => {
  const r = startLaboratory("berne-transactions");
  let checked = 0;
  for (const s of ["P", "A", "C"])
    for (const t of ["P", "A", "C"])
      for (const a of ["P", "A", "C"])
        for (const b of ["P", "A", "C"]) {
          r.reset({
            stimulusFrom: s,
            stimulusTo: t,
            responseFrom: a,
            responseTo: b,
          });
          const o = r.getObservables();
          assert.deepEqual(o.expected, {
            sender: "right",
            source: t,
            receiver: "left",
            target: s,
          });
          assert.equal(
            o.socialClass,
            a === t && b === s ? "complementary" : "crossed",
          );
          checked++;
        }
  assert.equal(checked, 81);
  r.reset({
    stimulusFrom: "P",
    stimulusTo: "C",
    responseFrom: "C",
    responseTo: "P",
  });
  assert.equal(r.getObservables().kind, "complementary");
});
test("other source OR other target crosses, and reversing participants reverses actual vectors", () => {
  const r = startLaboratory("berne-transactions");
  r.intervene("responseFrom", "P");
  assert.equal(r.getObservables().kind, "crossed");
  r.reset();
  r.intervene("responseTo", "C");
  assert.equal(r.getObservables().kind, "crossed");
  r.step("swap-roles");
  assert.deepEqual(r.getObservables().stimulus, {
    sender: "right",
    source: "A",
    receiver: "left",
    target: "A",
  });
  assert.equal(r.getObservables().response.sender, "left");
  assert.equal(r.getObservables().response.receiver, "right");
});
test("ulterior hypothesis preserves both levels; incomplete psychology remains unknown", () => {
  const r = startLaboratory("berne-transactions");
  r.intervene("hidden", true);
  r.intervene("psychResponseFrom", "P");
  const o = r.getObservables();
  assert.equal(o.kind, "ulterior");
  assert.equal(o.socialClass, "complementary");
  assert.equal(o.psychClass, "crossed");
  assert.equal(o.psychStimulus.source, "C");
  assert.equal(o.psychResponse.source, "P");
  r.intervene("psychStimulusTo", null);
  assert.equal(r.getObservables().kind, "insufficient-data");
  assert.equal(r.getObservables().psychClass, "not-represented");
  assert.equal(r.getObservables().psychExpected.source, null);
  r.intervene("hidden", false);
  assert.equal(r.getObservables().psychStimulus, null);
  assert.equal(r.getObservables().kind, "complementary");
});
test("all psychological endpoint combinations preserve unknowns and role symmetry", () => {
  const r = startLaboratory("berne-transactions");
  const values = ["P", "A", "C", null];
  let checked = 0;
  for (const initiator of ["left", "right"])
    for (const stimulusFrom of values)
      for (const stimulusTo of values)
        for (const responseFrom of values)
          for (const responseTo of values) {
            r.reset({
              initiator,
              hidden: true,
              psychStimulusFrom: stimulusFrom,
              psychStimulusTo: stimulusTo,
              psychResponseFrom: responseFrom,
              psychResponseTo: responseTo,
            });
            const before = r.getObservables();
            const known = [
              stimulusFrom,
              stimulusTo,
              responseFrom,
              responseTo,
            ].every((v) => v !== null);
            assert.equal(before.kind, known ? "ulterior" : "insufficient-data");
            assert.equal(
              before.psychClass,
              known
                ? responseFrom === stimulusTo && responseTo === stimulusFrom
                  ? "complementary"
                  : "crossed"
                : "not-represented",
            );
            r.step("swap-roles");
            const after = r.getObservables();
            assert.equal(after.kind, before.kind);
            assert.equal(after.psychClass, before.psychClass);
            assert.notEqual(after.stimulus.sender, before.stimulus.sender);
            r.intervene("hidden", false);
            assert.equal(r.getObservables().kind, before.socialClass);
            assert.equal(r.getObservables().psychStimulus, null);
            checked++;
          }
  assert.equal(checked, 512);
});
test("functional annotations do not silently reclassify structural transactions", () => {
  const r = startLaboratory("berne-transactions"),
    before = r.getObservables();
  r.intervene("leftFunction", "controlling");
  r.intervene("rightFunction", "free");
  assert.deepEqual(r.getObservables().stimulus, before.stimulus);
  assert.equal(r.getObservables().kind, before.kind);
  assert.deepEqual(r.getObservables().functional, {
    left: "controlling",
    right: "free",
  });
});
test("runtime traces changes, resets, accepts deterministic seeds and protects snapshots", () => {
  const r = startLaboratory("berne-transactions");
  let calls = 0;
  const unsub = r.subscribe(() => calls++);
  r.intervene("responseFrom", "P");
  r.step("swap-roles");
  assert.equal(calls, 2);
  assert.equal(r.getTrace().length, 3);
  assert.ok(
    r
      .getTrace()[1]
      .evaluations.some(
        (e) => e.rule === "socialClass" && e.value === "crossed",
      ),
  );
  const state = r.getState();
  state.inputs.responseFrom = "C";
  assert.equal(r.getState().inputs.responseFrom, "P");
  const tr = r.getTrace();
  tr.length = 0;
  assert.equal(r.getTrace().length, 3);
  unsub();
  r.reset({}, 42);
  assert.equal(calls, 2);
  assert.equal(r.getTrace().length, 1);
  assert.equal(r.getState().seed, 42);
  assert.equal(r.getObservables().kind, "complementary");
  assert.ok(r.getAssumptions().limitations.length);
  assert.equal(r.getAssumptions().claims[0].status, "didactic");
});
test("rejected interventions/events/invariants are atomic", () => {
  const p = bp();
  p.models[0].invariants.push({
    id: "test-guard",
    expr: { op: "ne", args: [{ ref: "input.stimulusFrom" }, "C"] },
  });
  const r = createRuntime(p, "berne-transactions");
  const before = r.getState(),
    trace = r.getTrace();
  for (const f of [
    () => r.intervene("stimulusFrom", "C"),
    () => r.intervene("stimulusFrom", "BOGUS"),
    () => r.intervene("stimulusFrom", null),
    () => r.intervene("unknown", 1),
    () => r.step({ type: "swap-roles", payload: 1 }),
    () => r.step("absent"),
    () => r.reset({ hidden: "yes" }),
    () => r.reset({ psychStimulusFrom: "unknown-state" }),
    () => r.intervene("leftFunction", "unknown-state"),
    () => r.reset({}, NaN),
  ])
    assert.throws(f);
  assert.deepEqual(r.getState(), before);
  assert.deepEqual(r.getTrace(), trace);
});
test("unknown affect is neither zero nor a category, and one supplied coordinate remains partial", () => {
  const r = startLaboratory("emotions-comparison");
  let o = r.getObservables();
  assert.deepEqual(o.dimensions.point, { valence: null, arousal: null });
  assert.equal(o.dimensions.complete, false);
  r.intervene("reportedValence", "neutral");
  o = r.getObservables();
  assert.equal(o.dimensions.point.valence, "neutral");
  assert.equal(o.dimensions.point.arousal, null);
  assert.equal(o.dimensions.complete, false);
  r.intervene("reportedArousal", "low");
  assert.equal(r.getObservables().dimensions.complete, true);
  assert.equal(r.getObservables().dimensions.emotionCategory, null);
});
test("adapters isolate inputs; control changes computed action set but cannot move affect", () => {
  const r = startLaboratory("emotions-comparison");
  r.intervene("reportedValence", "unpleasant");
  r.intervene("reportedArousal", "high");
  const before = r.getObservables();
  r.intervene("control", "high");
  const after = r.getObservables();
  assert.deepEqual(before.dimensions, after.dimensions);
  assert.notDeepEqual(before.appraisal.options, after.appraisal.options);
  assert.equal(after.appraisal.canInfluence, true);
  assert.equal(after.appraisal.emotionCategory, null);
  const frame = r.getTrace().at(-1);
  assert.deepEqual(
    Object.keys(
      frame.evaluations.find((e) => e.adapter === "dimensions").inputs,
    ),
    ["valence", "arousal"],
  );
  assert.deepEqual(
    Object.keys(
      frame.evaluations.find((e) => e.adapter === "appraisal").inputs,
    ),
    ["goal", "control", "expectation"],
  );
  r.intervene("reportedValence", "pleasant");
  assert.deepEqual(r.getObservables().appraisal, after.appraisal);
});
test("scenario snapshot/event transitions, unknown appraisal and irrelevant goal preserve scope", () => {
  const r = startLaboratory("emotions-comparison");
  r.step("capture");
  assert.equal(r.getState().states.captures, 1);
  r.intervene("goal", "supports");
  r.intervene("control", null);
  assert.deepEqual(r.getObservables().changedFields, ["goal", "control"]);
  assert.equal(r.getObservables().baseline.goal, "hinders");
  assert.equal(r.getObservables().appraisal.canInfluence, null);
  assert.deepEqual(r.getObservables().appraisal.options, [
    "use-available-time",
  ]);
  r.intervene("goal", "irrelevant");
  assert.equal(r.getObservables().appraisal.relevance, false);
  assert.deepEqual(r.getObservables().appraisal.options, []);
  r.reset();
  assert.equal(r.getObservables().baseline, null);
  assert.equal(r.getState().states.captures, 0);
  assert.equal(r.getTrace().length, 1);
});
test("registry returns defensive packages and scoped bindings; old atlas IDs unchanged", () => {
  const p = bp();
  p.models.length = 0;
  assert.ok(bp().models.length);
  assert.equal(laboratoryForConcept("berne", "trans").id, "berne-transactions");
  assert.equal(laboratoryForConcept("emotions", "trans"), null);
  assert.equal(
    laboratoryForConcept("emotions", "appraisal").id,
    "emotions-comparison",
  );
});
test("a helpful delay offers available time even when control is unknown", () => {
  const r = startLaboratory("emotions-comparison");
  r.intervene("goal", "supports");
  r.intervene("control", null);
  assert.deepEqual(r.getObservables().appraisal.options, [
    "use-available-time",
  ]);
  r.intervene("goal", "hinders");
  assert.deepEqual(r.getObservables().appraisal.options, ["clarify-control"]);
});
test("expression equality ignores object key order and events require own names", () => {
  assert.equal(
    evaluate(
      {
        op: "eq",
        args: [{ record: { a: 1, b: 2 } }, { record: { b: 2, a: 1 } }],
      },
      {},
    ),
    true,
  );
  assert.throws(
    () => startLaboratory("berne-transactions").step("toString"),
    /Unknown event/,
  );
});
