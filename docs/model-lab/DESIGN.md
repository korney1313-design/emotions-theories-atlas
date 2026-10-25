# Model Laboratory v0.1 — design before implementation

Issue #3. Existing Knowledge Atlas remains the host: 3D navigation → concept card → local laboratory dialog → same concept and graph. Existing 15 emotion models keep their entry points. No graph migration, database, framework or new application.

## Knowledge package

A JSON package contains `theories`, `concepts` (theory-scoped term senses), `claims`, `relations`, `sources`, `mechanisms`, `models`, `versions`, optionally `scenarios` and `adapters`. IDs are stable and cross-references validated. Claims have `theoryId`, logical `predicate`, participant roles (n-ary), status (`accepted-within-theory`, `contested`, `didactic`, `candidate`), provenance (source IDs or explicitly unknown reason), scope and limitation. A shared spelling never merges senses across theories. Bibliography and local source locators are references, not copied source texts.

Issue #4 adds optional `sourceSpan` to a claim or executable rule: `{sourceId, locator, basis, status}`. `sourceId` must also occur in that claim's or model's `sourceIds`; `basis` is `theoretical-text`, `lecture`, `atlas-data` or `project-design`; `status` is `reviewed`, `candidate` or `didactic`. The locator names a short, exact location without embedding private source text. `reviewed` means only that the locator was checked, not that the scientific claim was validated. A source without `sourceSpan` remains a general reference; the UI says the exact fragment is not yet known. Current spans identify public design passages for selected teaching rules. Unverified academic/lecture passages must not be upgraded to reviewed by inference.

## Executable model specification

Engine `rules-v1`: typed inputs + initial state, declared events with assignments, ordered named expression rules, observable projections, assumptions/domain/limitations, executable boolean invariants. A small JSON expression AST supports references, comparisons, boolean logic, records, arrays, conditional values and basic arithmetic. No eval, arbitrary functions, file/network access, loops or prose-rendering rule actions. UI renders data; it does not decide transaction class, relevant theory inputs or appraisal constraints.

Engine `comparison-v1` composes declared adapters over a shared ScenarioSpec. Each adapter maps only specified scenario fields into one rules-v1 ModelSpec; model outputs stay separate. Runtime API: reset(params, seed), step(event), intervene(variable,value), getState, getObservables, getTrace, getAssumptions, plus subscribe/unsubscribe. Returns are defensive copies. Invalid events/values/invariant failures must be atomic. Models deterministic; seed accepted and recorded for reproducibility, no invented stochastic law. Reset returns to declared defaults and clears trace to one reset entry. Trace includes event, changed input/state, rule expression/result and claim IDs.

## Pilot 1: Berne

Two participants, each P–A–C ordered vertically. Structural origin of ego-states and functional descriptions shown separately. Formal response expected to S = (sender,state → other,target) is R* = (other,target → sender,state). Actual R equals R* iff complementary. Otherwise crossed, without predicting communication termination. Optional psychological vectors coexist with social vectors; hidden level is explicitly stipulated as a teaching hypothesis, never inferred from words. Classification on each level remains visible. Role reversal preserves participants and reverses vector directions. Functional annotation does not change structural classifier. No diagnosis of real people.

With the hidden-level switch on, `ulterior` is shown only after all four psychological endpoints are specified. A missing endpoint yields `insufficient-data`: the social classification remains available, while the hidden classification is not established. Turning the switch off restores the social classification regardless of stored psychological inputs.

## Pilot 2: emotions

Scenario from lecture slide 24: work result delayed, deadline unknown. Russell-style descriptive adapter receives only reported valence/arousal; missing data are null, not neutral/zero. Appraisal adapter receives goal conduciveness, perceived control and expectation; it builds an explicit qualitative profile and didactic action-affordance set, without assigning emotion names, likelihoods, intensity or claiming to implement the full Scherer CPM. Changing control cannot automatically move the affect point. A baseline snapshot permits intervention comparison. Records and rule traces expose differences between a description and an explanatory hypothesis. Two perspectives are enough for this vertical slice; a third without adequate mechanism is deferred.

Every displayed action option is labelled as a teaching branch; its rule trace points to the public design paragraph and the didactic claim. The list is neither a causal prediction nor advice to choose one action.

## Validation and acceptance

Stage commits: design/examples; knowledge schema/runtime/packages; UI integration; tested report/publication. Unit coverage: schema/cross-theory references, wrong types, n-ary roles, unknown provenance, exhaustive 81 structural pairs, hidden boundaries, role changes, reset/trace, adapter isolation, null handling, snapshot/event transitions. Browser: real state changes, SVG vectors/axes, source/status links, reset, keyboard/mobile, graph return. Existing npm test/build/test:production required. Review screenshots and record self-assessment in artifacts/qa/ plus public safe copies and MODEL_LAB_PILOT.md. Existing global-layout limitation from issue #2 remains documented; no KK integration is planned here.
