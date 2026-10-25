import { OPERATORS, safeKey } from "./expression.js";
export const SCHEMA_VERSION = "model-package/0.1";
export const CLAIM_STATUSES = [
  "accepted-within-theory",
  "contested",
  "didactic",
  "candidate",
];
export const SOURCE_SPAN_STATUSES = ["reviewed", "candidate", "didactic"];
export const SOURCE_BASIS = [
  "theoretical-text",
  "lecture",
  "atlas-data",
  "project-design",
];
// Declarative entity vocabulary plus semantic cross-reference validation below.
export const ENTITY_SCHEMA = {
  theories: ["id", "label", "scope", "sourceIds"],
  concepts: ["id", "term", "theoryId", "definition", "sourceIds"],
  claims: [
    "id",
    "theoryId",
    "predicate",
    "roles",
    "status",
    "text",
    "sourceIds",
    "scope",
    "limitation",
  ],
  relations: ["id", "predicate", "roles", "claimIds"],
  sources: ["id", "title", "kind", "locator", "access", "verification"],
  mechanisms: ["id", "theoryId", "claimIds", "conceptIds", "description"],
  models: [
    "id",
    "version",
    "label",
    "engine",
    "theoryId",
    "mechanismIds",
    "claimIds",
    "sourceIds",
    "conceptIds",
    "inputs",
    "states",
    "events",
    "rules",
    "outputs",
    "assumptions",
    "validityDomain",
    "limitations",
    "invariants",
  ],
  versions: ["id", "modelId", "version", "schemaVersion", "changeSummary"],
  scenarios: ["id", "label", "fact", "fields", "claimIds"],
  adapters: ["id", "theoryId", "modelId", "scenarioId", "mapping", "claimIds"],
};
const plain = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const nonempty = (v) => typeof v === "string" && v.trim().length > 0;
export function checkValue(def, value, path = "value") {
  if (value === null) {
    if (def.nullable) return;
    throw Error(`${path}: null is not allowed`);
  }
  if (def.enum && !def.enum.includes(value))
    throw Error(`${path}: invalid enum value`);
  if (def.type === "enum") {
    if (!def.enum?.includes(value)) throw Error(`${path}: invalid enum`);
    return;
  }
  if (def.type === "number") {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (def.integer && !Number.isInteger(value)) ||
      (def.min !== undefined && value < def.min) ||
      (def.max !== undefined && value > def.max)
    )
      throw Error(`${path}: invalid number`);
    return;
  }
  if (def.type === "array") {
    if (!Array.isArray(value)) throw Error(`${path}: expected array`);
    if (def.items)
      value.forEach((v, i) => checkValue(def.items, v, `${path}[${i}]`));
    return;
  }
  if (def.type === "object") {
    if (!plain(value)) throw Error(`${path}: expected object`);
    if (def.fields) {
      for (const [k, d] of Object.entries(def.fields))
        checkValue(d, value[k], `${path}.${k}`);
      if (Object.keys(value).some((k) => !Object.hasOwn(def.fields, k)))
        throw Error(`${path}: unknown property`);
    }
    return;
  }
  if (!["string", "boolean"].includes(def.type) || typeof value !== def.type)
    throw Error(`${path}: invalid ${def.type}`);
}
function validatePackageInternal(pkg) {
  const errors = [];
  const fail = (m) => errors.push(m);
  const require = (ok, m) => {
    if (!ok) fail(m);
  };
  if (!plain(pkg))
    return { valid: false, errors: ["Package must be an object"] };
  require(pkg.schemaVersion === SCHEMA_VERSION, "Unsupported schemaVersion");
  const maps = {};
  const global = new Set();
  for (const [kind, fields] of Object.entries(ENTITY_SCHEMA)) {
    const list = pkg[kind] ?? [];
    if (!Array.isArray(list)) {
      fail(`${kind}: expected array`);
      maps[kind] = new Map();
      continue;
    }
    maps[kind] = new Map();
    for (const item of list) {
      if (!plain(item)) {
        fail(`${kind}: invalid entity`);
        continue;
      }
      require(nonempty(item.id), `${kind}: missing id`);
      require(!global.has(item.id), `Duplicate id ${item.id}`);
      global.add(item.id);
      maps[kind].set(item.id, item);
      for (const field of fields)
        require(Object.hasOwn(item, field), `${item.id}: missing ${field}`);
    }
  }
  for (const kind of [
    "theories",
    "concepts",
    "claims",
    "sources",
    "mechanisms",
    "models",
    "versions",
  ])
    require(maps[kind].size > 0, `${kind}: cannot be empty`);
  function refs(ids, kind, label, required = false) {
    if (!Array.isArray(ids)) {
      fail(`${label}: expected reference array`);
      return;
    }
    if (required)
      require(ids.length > 0, `${label}: at least one reference required`);
    ids.forEach((id) =>
      require(maps[kind].has(id), `${label}: unknown ${kind} ${id}`),
    );
  }
  function sourceSpan(span, sourceIds, label) {
    if (span === undefined) return;
    if (!plain(span)) {
      fail(`${label}: sourceSpan must be an object`);
      return;
    }
    require(
      Object.keys(span).every((key) =>
        ["sourceId", "locator", "basis", "status"].includes(key),
      ),
      `${label}: sourceSpan has unknown fields`,
    );
    require(
      nonempty(span.sourceId) &&
        maps.sources.has(span.sourceId) &&
        sourceIds?.includes(span.sourceId),
      `${label}: sourceSpan must reference a listed source`,
    );
    require(
      nonempty(span.locator) &&
        span.locator.length <= 240 &&
        !/[\r\n]/.test(span.locator),
      `${label}: sourceSpan needs a short exact locator`,
    );
    require(
      SOURCE_BASIS.includes(span.basis),
      `${label}: invalid sourceSpan basis`,
    );
    require(
      SOURCE_SPAN_STATUSES.includes(span.status),
      `${label}: invalid sourceSpan status`,
    );
  }
  const theory = (v, label) =>
    require(maps.theories.has(v), `${label}: unknown theory ${v}`);
  function roles(roles, label) {
    if (!Array.isArray(roles) || roles.length < 2) {
      fail(`${label}: at least two roles required`);
      return;
    }
    const names = new Set();
    for (const r of roles) {
      require(nonempty(r.role) &&
        !names.has(r.role), `${label}: invalid/duplicate role`);
      names.add(r.role);
      require(maps.concepts.has(
        r.conceptId,
      ), `${label}: unknown role concept ${r.conceptId}`);
    }
  }
  for (const t of maps.theories.values()) {
    require(nonempty(t.label) &&
      nonempty(t.scope), `${t.id}: theory text required`);
    refs(t.sourceIds, "sources", t.id);
  }
  for (const c of maps.concepts.values()) {
    theory(c.theoryId, c.id);
    require(nonempty(c.term) &&
      nonempty(c.definition), `${c.id}: term sense required`);
    refs(c.sourceIds, "sources", c.id);
  }
  for (const c of maps.claims.values()) {
    theory(c.theoryId, c.id);
    require(CLAIM_STATUSES.includes(c.status), `${c.id}: invalid status`);
    roles(c.roles, c.id);
    refs(c.sourceIds, "sources", c.id);
    sourceSpan(c.sourceSpan, c.sourceIds, c.id);
    require(c.sourceIds?.length > 0 ||
      nonempty(
        c.unknownProvenance,
      ), `${c.id}: source or explicit unknownProvenance required`);
    for (const f of ["text", "predicate", "scope", "limitation"])
      require(nonempty(c[f]), `${c.id}: ${f} required`);
  }
  for (const r of maps.relations.values()) {
    require(nonempty(r.predicate), `${r.id}: predicate required`);
    roles(r.roles, r.id);
    refs(r.claimIds, "claims", r.id, true);
  }
  for (const s of maps.sources.values()) {
    for (const f of ["title", "kind", "locator", "access", "verification"])
      require(nonempty(s[f]), `${s.id}: ${f} required`);
    if (s.url)
      require(/^https:\/\//.test(s.url), `${s.id}: source URL must be HTTPS`);
  }
  for (const m of maps.mechanisms.values()) {
    theory(m.theoryId, m.id);
    refs(m.claimIds, "claims", m.id, true);
    refs(m.conceptIds, "concepts", m.id, true);
    require(nonempty(m.description), `${m.id}: description required`);
  }
  function typed(def, label, initial = true) {
    if (!plain(def)) {
      fail(`${label}: missing type definition`);
      return;
    }
    require(["enum", "number", "string", "boolean", "array", "object"].includes(
      def.type,
    ), `${label}: unsupported type`);
    if (def.type === "enum")
      require(Array.isArray(def.enum) &&
        def.enum.length > 0, `${label}: enum values required`);
    if (initial) {
      require(Object.hasOwn(
        def,
        "initial",
      ), `${label}: initial value required`);
      try {
        checkValue(def, def.initial, label);
      } catch (e) {
        fail(e.message);
      }
    }
  }
  function expression(x, label, roots, depth = 0) {
    if (depth > 40) {
      fail(`${label}: expression too deep`);
      return;
    }
    if (x === null || ["string", "boolean"].includes(typeof x)) return;
    if (typeof x === "number") {
      require(Number.isFinite(x), `${label}: nonfinite number`);
      return;
    }
    if (Array.isArray(x)) {
      x.forEach((v) => expression(v, label, roots, depth + 1));
      return;
    }
    if (!plain(x)) {
      fail(`${label}: invalid expression`);
      return;
    }
    if (Object.hasOwn(x, "ref")) {
      require(Object.keys(x).length === 1, `${label}: ambiguous reference`);
      const parts = typeof x.ref === "string" ? x.ref.split(".") : [];
      require(parts.length >= 2 &&
        parts.every(safeKey) &&
        roots[parts[0]]?.has(parts[1]), `${label}: unknown reference ${x.ref}`);
      return;
    }
    if (Object.hasOwn(x, "record")) {
      require(Object.keys(x).length === 1 &&
        plain(x.record), `${label}: invalid record`);
      for (const [k, v] of Object.entries(x.record ?? {})) {
        require(safeKey(k), `${label}: invalid key`);
        expression(v, label, roots, depth + 1);
      }
      return;
    }
    require(Object.hasOwn(OPERATORS, x.op) &&
      Array.isArray(x.args) &&
      Object.keys(x).length === 2, `${label}: invalid operator`);
    if (Array.isArray(x.args)) {
      require(OPERATORS[x.op] === -1
        ? x.args.length > 0
        : x.args.length === OPERATORS[x.op], `${label}: wrong arity`);
      x.args.forEach((v) => expression(v, label, roots, depth + 1));
    }
  }
  for (const m of maps.models.values()) {
    theory(m.theoryId, m.id);
    refs(m.mechanismIds, "mechanisms", m.id, true);
    refs(m.claimIds, "claims", m.id, true);
    refs(m.conceptIds, "concepts", m.id, true);
    refs(m.sourceIds, "sources", m.id, true);
    refs(m.assumptions, "claims", `${m.id}.assumptions`, true);
    require(["rules-v1", "comparison-v1"].includes(
      m.engine,
    ), `${m.id}: unsupported engine`);
    require(/^\d+\.\d+\.\d+$/.test(
      m.version ?? "",
    ), `${m.id}: invalid version`);
    require(nonempty(m.validityDomain) &&
      Array.isArray(m.limitations) &&
      m.limitations.length > 0, `${m.id}: validity and limitations required`);
    for (const section of ["inputs", "states"]) {
      require(plain(m[section]), `${m.id}: invalid ${section}`);
      for (const [k, def] of Object.entries(m[section] ?? {})) {
        require(safeKey(k), `${m.id}: invalid variable`);
        typed(def, `${m.id}.${section}.${k}`);
      }
    }
    const roots = {
      input: new Set(Object.keys(m.inputs ?? {})),
      state: new Set(Object.keys(m.states ?? {})),
      derived: new Set(),
      adapter: new Set(m.adapterIds ?? []),
    };
    if (m.engine === "comparison-v1") {
      require(maps.scenarios.has(m.scenarioId), `${m.id}: scenario required`);
      refs(m.adapterIds, "adapters", m.id, true);
      const fields = maps.scenarios.get(m.scenarioId)?.fields;
      require(JSON.stringify(fields) ===
        JSON.stringify(m.inputs), `${m.id}: scenario fields must match inputs`);
      for (const id of m.adapterIds ?? [])
        require(maps.adapters.get(id)?.scenarioId ===
          m.scenarioId, `${m.id}: adapter scenario mismatch`);
    } else
      require(!m.adapterIds
        ?.length, `${m.id}: rules engine cannot contain adapters`);
    require(Array.isArray(m.rules), `${m.id}: rules required`);
    for (const r of m.rules ?? []) {
      require(safeKey(r.id) &&
        !roots.derived.has(r.id), `${m.id}: invalid/duplicate rule`);
      refs(r.claimIds, "claims", r.id, true);
      sourceSpan(r.sourceSpan, m.sourceIds, `${m.id}.${r.id}`);
      expression(r.expr, `${m.id}.${r.id}`, roots);
      roots.derived.add(r.id);
    }
    require(plain(m.outputs), `${m.id}: outputs required`);
    for (const [k, o] of Object.entries(m.outputs ?? {})) {
      typed(o, `${m.id}.outputs.${k}`, false);
      refs(o.claimIds, "claims", k, true);
      expression(o.expr, k, roots);
    }
    require(Array.isArray(m.invariants) &&
      m.invariants.length > 0, `${m.id}: invariants required`);
    for (const inv of m.invariants ?? []) {
      require(nonempty(inv.id), `${m.id}: invariant id required`);
      expression(inv.expr, inv.id, roots);
    }
    require(plain(m.events), `${m.id}: events required`);
    for (const [name, e] of Object.entries(m.events ?? {})) {
      require(safeKey(name) && plain(e.assign), `${m.id}: invalid event`);
      refs(e.claimIds, "claims", name, true);
      for (const [target, expr] of Object.entries(e.assign ?? {})) {
        const [root, key, ...rest] = target.split(".");
        require(["input", "state"].includes(root) &&
          roots[root]?.has(key) &&
          rest.length === 0, `${m.id}: invalid assignment ${target}`);
        // Events use current input/state; no arbitrary payload or implicit scientific time evolution.
        expression(expr, `${m.id}.${name}`, {
          input: roots.input,
          state: roots.state,
        });
      }
    }
  }
  for (const s of maps.scenarios.values()) {
    require(nonempty(s.label) &&
      nonempty(s.fact), `${s.id}: scenario text required`);
    refs(s.claimIds, "claims", s.id, true);
    for (const [k, d] of Object.entries(s.fields ?? {}))
      typed(d, `${s.id}.${k}`);
  }
  for (const a of maps.adapters.values()) {
    theory(a.theoryId, a.id);
    refs(a.claimIds, "claims", a.id, true);
    const child = maps.models.get(a.modelId),
      scenario = maps.scenarios.get(a.scenarioId);
    require(child?.engine ===
      "rules-v1", `${a.id}: adapter must target rules-v1 (no recursive composition)`);
    require(child?.theoryId === a.theoryId, `${a.id}: theory mismatch`);
    require(scenario && plain(a.mapping), `${a.id}: scenario/mapping required`);
    require(Object.keys(a.mapping ?? {}).length ===
      Object.keys(child?.inputs ?? {}).length, `${a.id}: incomplete mapping`);
    for (const [target, source] of Object.entries(a.mapping ?? {})) {
      const d = child?.inputs?.[target],
        s = scenario?.fields?.[source];
      require(d && s, `${a.id}: unknown mapping field`);
      if (d && s)
        require(d.type === s.type &&
          !!d.nullable === !!s.nullable &&
          JSON.stringify(d.enum) ===
            JSON.stringify(s.enum), `${a.id}: incompatible mapping type`);
    }
  }
  for (const v of maps.versions.values()) {
    const m = maps.models.get(v.modelId);
    require(m && m.version === v.version, `${v.id}: model version mismatch`);
    require(v.schemaVersion === SCHEMA_VERSION, `${v.id}: schema mismatch`);
    require(nonempty(v.changeSummary), `${v.id}: change summary required`);
  }
  for (const m of maps.models.values())
    require([...maps.versions.values()].some(
      (v) => v.modelId === m.id && v.version === m.version,
    ), `${m.id}: version record missing`);
  return { valid: errors.length === 0, errors };
}
export function validatePackage(pkg) {
  try {
    return validatePackageInternal(pkg);
  } catch (error) {
    return { valid: false, errors: [`Malformed package: ${error.message}`] };
  }
}
export function assertPackage(pkg) {
  const r = validatePackage(pkg);
  if (!r.valid) throw Error(`Invalid Model Package:\n${r.errors.join("\n")}`);
  return pkg;
}
