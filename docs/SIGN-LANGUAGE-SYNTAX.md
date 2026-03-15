# Sign Language for Syntax — Visual Intent Classification System

> **Status:** Concept / Pre-implementation
> **Origin:** prompt-quant-visualizer session, conceptual design phase
> **Next step:** Validate against distilled conversation corpus on transfer machine

---

## 1. Vision

A composable visual grammar where shapes and motions encode **intent** — readable at a glance without reading prompt text. Analogous to sign language: handshape + movement + location + orientation = meaning.

The goal is to look at a glyph sequence in the starmap and *read* what a session did: "fetch, enrich, iterate, reduce, ship" — purely from visual primitives.

---

## 2. The Grammar — Four Composable Layers

| Layer | Linguistic Role | Visual Primitive | What It Encodes |
|-------|----------------|------------------|-----------------|
| **Glyph** | Noun (what) | 3D shape | The target or object of intent |
| **Motion** | Verb (action) | Animation/trajectory | What happens to the target |
| **Path** | Preposition (where) | Spatial trajectory | Direction, destination, scope |
| **Valence** | Outcome | Elevation delta (Y-axis) | Improvement, neutral, or reduction |
| **Surface** | Modifier/adjective | Material treatment | Certainty, state, urgency |

---

## 3. Glyph Vocabulary (Nouns — What Is Being Acted On)

| Glyph | Shape | Represents | Rationale |
|-------|-------|-----------|-----------|
| **BOX** | Cube | Data, object, concrete thing | A container — it holds stuff |
| **WORLD** | Sphere | State, context, environment | No edges — ambient, everywhere |
| **DECIDE** | Tetrahedron | Decision, condition, branch point | Minimum viable polyhedron — simplest fork |
| **CYCLE** | Ring / Torus | Process, loop, iteration | Continuous, no start/end |
| **GO** | Arrow / Vector | Directive, imperative, command | Points somewhere — "do this" |
| **BIRTH** | Star / Burst | Event, creation, emergence | Radiates outward — something new |
| **EXPOSE** | Inverted mesh (interior faces) | Reduction, introspection, deconstruction | Looking *inside* — opened up, simplified |

### Glyph Notes

- Glyphs are the **static identity** of an intent node
- A node's glyph should be determinable from intent classification alone
- Multiple glyphs can coexist in a compound action (e.g., GO + BOX = "go get the thing")
- The **inverted mesh** (reversed normals, interior faces visible) is specifically for reduction/deconstruction — viscerally communicates "turned inside out"

---

## 4. Motion Vocabulary (Verbs — What Action Is Performed)

| Motion | Animation | Represents | Example Prompt |
|--------|-----------|-----------|----------------|
| **LINEAR** | Straight translate A→B | Direct action, no transformation | "Delete this", "Move that" |
| **ARC** | Curved path A→B | Action with effort/distance | "Send this to the API" |
| **SPIRAL-FLAT** | Helix, no elevation change | Iterative process, neutral outcome | "Keep checking status" |
| **SPIRAL-UP** | Ascending helix | Outward + return + improvement | "Fetch data, process, return enriched" |
| **SPIRAL-DOWN** | Descending helix | Outward + return + reduction | "Take this, compress, return smaller" |
| **ORBIT** | Circle without touching | Continuous observation | "Watch this value", "monitor" |
| **PULSE** | Scale breathe in place | Alive, waiting, ambient | "This exists and is active" |
| **BURST** | Expand outward from center | Creation, emission, generation | "Generate", "spawn", "create" |
| **COLLAPSE** | Contract inward to center | Destruction, absorption | "Delete", "consume", "merge into" |
| **FORK** | Path splits into 2+ branches | Conditional branching | "If X then Y else Z" |
| **BRAID** | Paths interweave | Composition, interleaving | "Combine these streams" |

---

## 5. Valence — The Vertical Axis as Semantic Outcome

The Y-axis (elevation) carries meaning:

```
        ↑  ASCENDING = enrichment, improvement, growth, addition
        ─  LEVEL     = transformation, neutral exchange, lateral move
        ↓  DESCENDING = compression, reduction, simplification
        ⊗  INVERTED  = deconstruction (surface flip, not just position)
```

### Valence Mapping

- **Spiral up + detail increase**: The glyph gains fractal complexity as it ascends
- **Spiral down + detail decrease**: The glyph simplifies, loses tessellation
- **Level transform**: Glyph A morphs into Glyph B at same elevation
- **Inversion**: Mesh normals flip — you see interior faces. Not a position change, a *perspective* change on the object itself

---

## 6. Surface Treatment (Modifiers)

| Treatment | Meaning | Implementation |
|-----------|---------|----------------|
| **Solid fill** | Concrete, resolved, certain | `MeshStandardMaterial`, opacity 1.0 |
| **Wireframe** | Abstract, potential, in-progress | `WireframeGeometry`, existing system |
| **Glowing / emissive** | Active, hot, executing now | High emissive intensity + bloom |
| **Translucent** | Tentative, conditional, uncertain | Low opacity (0.3-0.5), no bloom |
| **Pulsing opacity** | Awaiting input, blocked, pending | Animated opacity oscillation |
| **Particle dissolution** | Ephemeral, temporary, will expire | Points/particles drifting off surface |

---

## 7. Composition Patterns — How Glyphs Combine

These are the "sentences" of the visual language:

```
FETCH:      GO → Arc out → [TARGET GLYPH] → Spiral return to origin
            (flat spiral = raw fetch, ascending = fetch + enrich)

CREATE:     BIRTH burst → [NEW GLYPH emerges from center]

TRANSFORM:  [GLYPH A] → Spiral (level) → [GLYPH B] (shape morphs mid-spiral)

CONDITIONAL: DECIDE → Fork → [BRANCH A glyph] | [BRANCH B glyph]

ITERATE:    CYCLE → [GLYPH passes through ring repeatedly]
            (ascending ring = improving each pass, descending = reducing)

REDUCE:     [GLYPH] → Spiral down → [EXPOSE / inverted glyph]

ENRICH:     [GLYPH] → Spiral up → [Higher-detail fractal glyph]

MONITOR:    WORLD → Orbit (never touches, just watches)

CHAIN:      Glyph₁ → Arc → Glyph₂ → Arc → Glyph₃ (sequential pipeline)

COMPOSE:    Glyph₁ + Glyph₂ → Braid → [MERGED GLYPH]
```

### Example Readings

**"Go over there"**
→ `GO` (arrow glyph) + `LINEAR` motion. Single vector. Done.

**"Go over there, grab me a box, put it over here"**
→ `GO` → `ARC out` → `BOX` appears at destination → `SPIRAL-FLAT return` (box rides the spiral back). Flat because no transformation — it's a pure fetch.

**"Go get that data, process it, bring it back better"**
→ `GO` → `ARC out` → `BOX` → `SPIRAL-UP return`. The box gains detail/glow as it ascends. Spiral indicates enrichment happened during return.

**"Simplify this module"**
→ `BOX` (the module) → `SPIRAL-DOWN` → `EXPOSE` (inverted mesh). The box descends, loses detail, and its faces flip to show interior. You *see* the reduction.

**"If the tests pass, deploy; otherwise fix and retry"**
→ `DECIDE` (tetrahedron) → `FORK` → Branch A: `BIRTH` (deploy, star burst) | Branch B: `CYCLE` (retry loop, torus) containing smaller `BOX` fix action.

**"Watch the build pipeline"**
→ `WORLD` (sphere, the environment) → `ORBIT` motion. The sphere slowly rotates, a satellite traces circles. Nothing is touched, just observed.

---

## 8. Mapping to Existing Codebase

### What Already Exists (prompt-quant-visualizer)

| System | Current Use | New Use in Intent Language |
|--------|------------|---------------------------|
| Fractal depth on nodes | Encodes complexity metric | Encodes **enrichment level** — more detail = more enriched |
| Satellite orbits | Metric indicators | The **MONITOR** motion pattern |
| Spline paths (metro-style) | Connect sequential nodes | The **ARC/PATH** trajectory system |
| Bloom/glow | Active state indicator | The **ACTIVE/EXECUTING** surface modifier |
| Wireframe material | Default aesthetic | The **ABSTRACT/POTENTIAL** surface modifier |
| Spiral layout (placeholder) | Unused layout algorithm | Literal **ENRICH/REDUCE** motion |
| Node click/focus | Navigation | Intent inspection — zoom in to read the "sentence" |

### What Needs to Be Built

1. **Intent classifier** — Analyze prompt text → assign glyph + motion + valence
2. **Glyph geometry generator** — Extend `nodes.js` to produce all 7 glyph types (currently only fractal icosahedrons)
3. **Motion animation system** — Extend `paths.js` to animate glyphs along spiral/arc/fork trajectories (currently only traveling pulse)
4. **Inverted mesh renderer** — Flip normals, render back-faces for EXPOSE glyph
5. **Composition renderer** — Handle compound glyphs (FETCH = GO + ARC + TARGET + SPIRAL)
6. **Valence elevation mapping** — Y-position tied to outcome, not just layout

---

## 9. Intent Classification Categories (For the Classifier)

These are the categories to extract from prompt text:

```
DIRECTIVE    — "do X", "run X", "execute X"
FETCH        — "get X", "retrieve X", "pull X", "find X"
CREATE       — "make X", "generate X", "write X", "build X"
TRANSFORM    — "change X to Y", "convert X", "refactor X"
REDUCE       — "simplify X", "compress X", "minimize X", "clean up X"
ENRICH       — "improve X", "enhance X", "add to X", "extend X"
INSPECT      — "show me X", "what is X", "explain X", "look at X"
MONITOR      — "watch X", "check X status", "keep an eye on X"
CONDITIONAL  — "if X then Y", "when X do Y", "unless X"
ITERATE      — "for each X", "repeat X", "loop over X", "keep doing X"
COMPOSE      — "combine X and Y", "merge X with Y", "pipe X into Y"
DESTROY      — "delete X", "remove X", "drop X", "kill X"
```

### Classifier → Visual Mapping

```
DIRECTIVE   → GO glyph     + LINEAR motion  + level valence
FETCH       → GO glyph     + ARC out        + SPIRAL return (flat)
CREATE      → BIRTH glyph  + BURST motion   + ascending valence
TRANSFORM   → BOX glyph    + SPIRAL-FLAT    + level valence (morphs shape)
REDUCE      → BOX glyph    + SPIRAL-DOWN    + descending valence → EXPOSE
ENRICH      → BOX glyph    + SPIRAL-UP      + ascending valence (gains detail)
INSPECT     → WORLD glyph  + PULSE motion   + level valence
MONITOR     → WORLD glyph  + ORBIT motion   + level valence
CONDITIONAL → DECIDE glyph + FORK motion    + valence per branch
ITERATE     → CYCLE glyph  + repeating ARC  + valence per iteration
COMPOSE     → multi-glyph  + BRAID motion   + level valence
DESTROY     → BOX glyph    + COLLAPSE motion + descending valence
```

---

## 10. Transfer Notes — For the Distilled Corpus Machine

### What To Do With This

1. **Load the distilled conversation corpus**
2. **Run intent classification** on each prompt — assign one of the 12 categories above
3. **Validate the vocabulary**: Are there intents that don't fit any category? If so, we need new glyphs/motions
4. **Check composability**: Do real prompts decompose cleanly into glyph + motion + valence? Or do we need more compound patterns?
5. **Look for frequency**: Which intents dominate? Those get the most visually distinct glyphs
6. **Test readability**: Can you look at a proposed glyph sequence and *read back* what the session did without seeing the text?

### Key Questions to Answer

- [ ] Are 12 intent categories enough, or do we need finer granularity?
- [ ] Do compound prompts (multiple intents in one message) decompose cleanly?
- [ ] What's the distribution? If 80% of prompts are FETCH/CREATE, those glyphs need the most visual differentiation
- [ ] Does the spiral-up/down valence feel right when you mentally apply it to real enrichment/reduction prompts?
- [ ] Is the inverted mesh (EXPOSE) readable at the scale nodes appear in the starmap, or do we need a different reduction indicator?
- [ ] Should CHAIN (sequential multi-step) be its own glyph, or is it always a composition of simpler glyphs?

### Files to Reference

- `src/viz/nodes.js` — Current fractal geometry system. Extend this for new glyphs
- `src/viz/paths.js` — Current path/spline system. Extend for spiral/fork/braid motions
- `src/viz/satellites.js` — Orbiting system. Reusable for MONITOR pattern
- `src/viz/starmap.js` — Scene manager. Layout algorithms live here
- `docs/art-direction-codex.md` — Crystalline/wireframe aesthetic direction
- `docs/art-direction-aurora.md` — Celestial/organic aesthetic direction

### Implementation Priority (Suggested)

```
Phase 1: Intent classifier (text → category)
Phase 2: Glyph geometries (7 distinct shapes)
Phase 3: Motion system (11 animation types)
Phase 4: Valence elevation mapping
Phase 5: Composition renderer (compound glyphs)
Phase 6: Surface treatment modifiers
Phase 7: Reading mode (hover a sequence, get narrated intent)
```

---

## 11. Open Design Questions

### The Spiral Problem
A spiral is both a *motion* (how something moves) and a potential *layout* (how nodes arrange). Need to decide: does the spiral belong to individual node animation, to the path between nodes, or to the macro layout of the session? Possibly all three at different scales:
- **Micro**: Single glyph spins/spirals in place (self-transformation)
- **Meso**: Path between two nodes follows a helical trajectory (fetch+return)
- **Macro**: Session-level layout spirals outward (overall session was iterative)

### The Density Question
In a long session with 50+ prompts, can you still read individual glyph compositions? Or do we need a "zoom semantic" where:
- **Far**: See only the macro shape (session is a spiral, a line, a starburst)
- **Mid**: See glyph types but not motions (icons for each node)
- **Close**: See full composition (glyph + motion + valence + surface)

### Color vs Shape
Current system uses color for state (active/historical/error). If glyphs now carry shape-meaning, do we free color for something else? Or does color become a **domain** indicator (file ops = amber, API = cyan, UI = magenta) while shape = intent?

---

## 12. The Bigger Picture

This is not just a visualization feature. If the grammar is expressive enough, it becomes:

1. **A visual programming language for intent** — composable, readable, transcends natural language
2. **A session fingerprint** — the glyph sequence IS the session summary
3. **A pattern recognition tool** — spot anti-patterns (too many FETCH-no-ENRICH = thrashing), good patterns (CREATE → ITERATE-UP → REDUCE → ship)
4. **A cross-language interface** — works regardless of what natural language the prompts were in
5. **A compression layer** — the entire intent of a 200-message session reduced to a readable glyph stream
