import { copy, evaluate } from "./expression.js";
import { assertPackage, checkValue } from "./schema.js";
export function createRuntime(packageData, modelId) {
  const pkg = copy(packageData);
  assertPackage(pkg);
  const model = pkg.models.find((m) => m.id === modelId);
  if (!model) throw Error(`Unknown model ${modelId}`);
  let current,
    observables,
    trace = [],
    seed = 0;
  const listeners = new Set();
  const defaults = (defs) =>
    Object.fromEntries(
      Object.entries(defs).map(([k, v]) => [k, copy(v.initial)]),
    );
  const check = (defs, values) => {
    for (const [k, d] of Object.entries(defs)) checkValue(d, values[k], k);
    if (Object.keys(values).some((k) => !Object.hasOwn(defs, k)))
      throw Error("Unknown variable");
  };
  function compute(m, inputs, states) {
    check(m.inputs, inputs);
    check(m.states, states);
    const env = { input: inputs, state: states, derived: {}, adapter: {} };
    const evaluations = [];
    for (const id of m.adapterIds ?? []) {
      const a = pkg.adapters.find((v) => v.id === id),
        child = pkg.models.find((v) => v.id === a.modelId);
      const mapped = Object.fromEntries(
        Object.entries(a.mapping).map(([target, source]) => [
          target,
          copy(inputs[source]),
        ]),
      );
      const result = compute(child, mapped, defaults(child.states));
      env.adapter[id] = result.outputs;
      evaluations.push({
        adapter: id,
        modelId: child.id,
        theoryId: a.theoryId,
        inputs: mapped,
        mapping: copy(a.mapping),
        rules: result.evaluations,
      });
    }
    for (const rule of m.rules) {
      const value = evaluate(rule.expr, env);
      env.derived[rule.id] = value;
      evaluations.push({
        rule: rule.id,
        expression: copy(rule.expr),
        value: copy(value),
        claimIds: copy(rule.claimIds),
        sourceSpan: rule.sourceSpan ? copy(rule.sourceSpan) : null,
      });
    }
    const outputs = Object.fromEntries(
      Object.entries(m.outputs).map(([k, o]) => {
        const v = evaluate(o.expr, env);
        checkValue(o, v, k);
        return [k, v];
      }),
    );
    for (const inv of m.invariants)
      if (evaluate(inv.expr, env) !== true)
        throw Error(`Invariant failed: ${inv.id}`);
    return { outputs, evaluations };
  }
  function commit(next, event, resetTrace = false, nextSeed = seed) {
    const result = compute(model, next.inputs, next.states); // Validate before any observable mutation.
    const previous = current ? copy(current) : null;
    current = copy(next);
    observables = copy(result.outputs);
    seed = nextSeed;
    if (resetTrace) trace = [];
    trace.push({
      index: trace.length,
      event: copy(event),
      modelId: model.id,
      version: model.version,
      seed,
      before: resetTrace ? null : previous,
      after: copy(current),
      evaluations: result.evaluations,
      observables: copy(observables),
    });
    for (const fn of listeners) fn(api.getState(), api.getObservables());
    return api.getState();
  }
  const api = {
    reset(params = {}, nextSeed = 0) {
      if (!params || Array.isArray(params) || typeof params !== "object")
        throw Error("reset expects params");
      if (!Number.isSafeInteger(nextSeed))
        throw Error("seed must be an integer");
      const inputs = { ...defaults(model.inputs), ...copy(params) };
      return commit(
        { inputs, states: defaults(model.states) },
        { type: "reset", params: copy(params) },
        true,
        nextSeed,
      );
    },
    step(event) {
      const name = typeof event === "string" ? event : event?.type;
      if (
        typeof event !== "string" &&
        (!event || Object.keys(event).some((k) => k !== "type"))
      )
        throw Error("Event payload is not supported in DSL v0.1");
      const def = Object.hasOwn(model.events, name) ? model.events[name] : null;
      if (!def) throw Error(`Unknown event: ${name}`);
      const next = copy(current),
        env = { input: current.inputs, state: current.states };
      // All assignments read pre-event state; applied simultaneously.
      for (const [target, expr] of Object.entries(def.assign)) {
        const [root, key] = target.split(".");
        next[root === "input" ? "inputs" : "states"][key] = evaluate(expr, env);
      }
      return commit(next, { type: name, claimIds: def.claimIds });
    },
    intervene(variable, value) {
      if (!Object.hasOwn(model.inputs, variable))
        throw Error(`Unknown input: ${variable}`);
      checkValue(model.inputs[variable], value, variable);
      const next = copy(current);
      next.inputs[variable] = copy(value);
      return commit(next, { type: "intervene", variable, value: copy(value) });
    },
    getState: () =>
      copy({ ...current, modelId: model.id, version: model.version, seed }),
    getObservables: () => copy(observables),
    getTrace: () => copy(trace),
    getAssumptions: () =>
      copy({
        claims: model.assumptions.map((id) =>
          pkg.claims.find((c) => c.id === id),
        ),
        validityDomain: model.validityDomain,
        limitations: model.limitations,
      }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  api.reset();
  return api;
}
