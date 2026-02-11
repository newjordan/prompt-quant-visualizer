# WILDCARD-1: Critical Analysis & Gap Report

**Investigator:** Wildcard Agent (Opus 4.6 ultrathink)  
**Date:** 2026-02-11 02:40 CST  
**Status:** Complete

---

## Executive Summary

The Prompt Quant Visualizer is **impressively close to demo-ready** for an overnight build. The architecture is sound, the visual design is well-specified (with TWO competing art directions!), and the core implementation covers most bases. However, several critical gaps could sabotage the demo or live-desktop integration. This document identifies them in priority order.

**Overall Assessment:** 🟡 **MVP-viable with caveats**

---

## 1. GAP ANALYSIS: Spec vs. Implementation

### ✅ Implemented (Good Coverage)

| Component | Spec Section | Implementation | Notes |
|-----------|--------------|----------------|-------|
| Session Parser | §3 | `src/data/parser.js` | Solid, handles content blocks correctly |
| Metrics Calculator | §4 | `src/data/metrics.js` | Complete with focus/complexity scores |
| Node Geometry | §5.2 | `src/viz/nodes.js` | Wireframe + glow working |
| Satellite System | §5.3 | `src/viz/satellites.js` | Orbits + tool-type coloring |
| Path Connections | - | `src/viz/paths.js` | Subway curves adapted from live-desktop |
| StarmapRenderer | §5 | `src/viz/starmap.js` | Full Three.js setup with bloom |
| Navigation | §6.1 | `src/ui/navigation.js` | Keyboard + timeline scrubber |
| Details Panel | §6.2 | `src/ui/details-panel.js` | All metrics displayed |
| Widget Shell | §6.4 | `src/ui/widget.js` | Orchestration complete |
| CSS Styling | - | `public/style.css` | ~800 lines, fully frost-glass |

### ⚠️ Partially Implemented

| Component | Spec Section | Status | Gap |
|-----------|--------------|--------|-----|
| Camera Modes | §5.1 | 🟡 Orbit only | "Follow" mode for auto-tracking not implemented |
| Semantic Similarity | §4.2 | 🟡 Heuristic | Uses keyword overlap, not embeddings (acceptable for MVP) |
| Layout Algorithms | §5.1 | 🟡 Basic | `cluster` and `spiral` are placeholders, only `path` is real |
| Glow Effects | §5 | 🟡 Global only | Per-node emissive intensity not dynamically adjustable |

### ❌ Not Implemented / Missing

| Component | Spec Section | Impact | Recommendation |
|-----------|--------------|--------|----------------|
| **Live-Desktop Embed** | §8 | 🔴 Critical | `src/integration/live-desktop-embed.ts` referenced in spec but doesn't exist! |
| **package.json** | §9 | 🔴 Critical | No package.json = can't `npm install` or run dev server |
| **Test Files** | §7 `test/` | 🟡 Medium | `test/` directory is empty |
| **TypeScript** | §7 | 🟡 Medium | All files are `.js` not `.ts` despite spec calling for TypeScript |
| **vite.config.ts** | §10 | 🔴 Critical | No build configuration exists |
| **Bundle for embed** | §10.2 | 🔴 Critical | `bundle:embed` script mentioned but impossible without config |
| **StarmapRenderer export** | `src/viz/starmap-renderer.ts` | 🔴 Critical | Widget imports from `starmap-renderer.js` but file is `starmap.js` |

---

## 2. EDGE CASES: Scale Testing

### 2.1 Single Node (n=1)

**Current behavior:** Likely crashes or renders weirdly.

**Issues:**
- `createPathBetween()` called for `i=1` but loop starts at 1, so no paths created ✅
- But `focusNode(0)` with `nodes.length=1` calculates camera offset without issue ✅
- **Timeline scrubber** with 1 node = 100% filled, single dot. Looks fine.

**Recommendation:** Visually boring but functional. Add "minimum session" tooltip: "Load a session with more prompts for the full experience."

### 2.2 Small Session (n=5-10)

**Current behavior:** Good.

**Issues:** None. This is the "happy path" the demo will probably target.

### 2.3 Medium Session (n=50-100)

**Current behavior:** Should be fine based on spec targets (≥30 FPS at 100 nodes).

**Issues:**
- Path drawing animation (`createPathDrawAnimation`) runs for ALL paths on load, not just new ones
- With 100 paths animating simultaneously, could cause jank

**Recommendation:** Only animate paths created AFTER initial load, not during `setNodes()`.

### 2.4 Large Session (n=500+)

**Current behavior:** ⚠️ Untested, likely performance cliff.

**Issues:**
- `maxVisibleNodes: 200` exists in options but **not enforced anywhere in code**
- No LOD (Level of Detail) implementation despite spec mentioning it
- No object pooling — each node creates 3-4 Three.js objects
- No frustum culling for off-screen nodes

**Recommendations:**
1. Implement `maxVisibleNodes` enforcement with visibility culling
2. Hide satellites for nodes > 50 steps from current
3. Reduce path segment count for distant paths

### 2.5 Empty Session (n=0)

**Current behavior:** 
```javascript
if (this.nodes.length > 0) { this.currentIndex = 0; ... }
```
Safe-ish, but...

**Issues:**
- `buildSessionMeta` with empty nodes returns `createEmptyMeta()` — ✅ handled
- `_renderPlaceholderNodes()` shows nothing (container empty) — confusing UX

**Recommendation:** Show explicit "No prompts found" message in placeholder.

---

## 3. VISUAL IMPACT: Will This Look Cool?

### 3.1 What Works

- **Frost Glass aesthetic** is pixel-perfect (CSS is excellent)
- **Wireframe primitives with bloom** will look great
- **Metro-style subway curves** match live-desktop perfectly
- **Satellite orbits** add depth and motion
- **Pulse particles on paths** create nice "data flow" effect

### 3.2 What's Missing for "Wow"

| Missing Element | Impact | Effort | Priority |
|-----------------|--------|--------|----------|
| **Background starfield animation** | Creates static feeling | Low | P2 |
| **Node birth "pop" sound** | Demo lacks punch | Low (if audio available) | P3 |
| **Camera "whoosh" on focus change** | Transitions feel flat | Medium | P1 |
| **Depth of field / blur** | Foreground/background separation | High | P3 |
| **Particle trail on active path** | Would show conversation "energy" | Medium | P2 |
| **Node labels on hover** | Can't tell which is which without clicking | Low | P1 |

### 3.3 Art Direction Conflict

**Problem:** Two competing art directions exist:
- `art-direction-codex.md` — Cool blue tones, systematic
- `art-direction-aurora.md` — Warmer palette with gold satellites

**Current Implementation:** Follows Codex mostly, but mixes some Aurora elements (satellite colors).

**Recommendation:** Pick one. Aurora palette is more visually distinctive. Codex is safer/cleaner.

### 3.4 Demo Killer: Loading State

The current loading state is a spinner with "Initializing starmap..." — **boring**.

**Recommendation:** Show a "constellating..." animation with wireframe shapes fading in/out while loading.

---

## 4. INTEGRATION: Live-Desktop Embedding

### 4.1 Current State: NOT READY

The spec defines a detailed `live-desktop-embed.ts` module (§8), but it **doesn't exist**. The widget shell attempts a dynamic import:

```javascript
const vizModule = await import('../viz/starmap-renderer.js').catch(() => null);
```

But the file is `starmap.js`, not `starmap-renderer.js`.

### 4.2 Integration Challenges

| Challenge | Severity | Solution |
|-----------|----------|----------|
| **CSS3DRenderer vs WebGL** | 🔴 | Bloom won't work in CSS3DObject; need separate WebGL layer or disable glow |
| **Z-fighting** | 🟡 | Neural network lines may intersect with starmap; need separate render order |
| **Event handling** | 🟡 | Click events in CSS3D need careful bubbling management |
| **Coordinate systems** | 🟡 | live-desktop uses different world scale; need transform group |
| **Performance budget** | 🟡 | Adding 100+ objects to existing scene may exceed frame budget |

### 4.3 Recommended Integration Path

1. **Phase 1 (Now):** Get standalone working perfectly
2. **Phase 2:** Create `src/integration/standalone.ts` that properly initializes
3. **Phase 3:** Create `src/integration/live-desktop-embed.ts` using spec §8 as template
4. **Phase 4:** Add to live-desktop's `createDesktopWindows()` behind feature flag

---

## 5. DATA QUALITY: Session File Analysis

### 5.1 Real Session Structure

Checked `/home/frosty/.openclaw/agents/main/sessions/*.jsonl`:

```
Total sessions: ~33 files
Total lines: 6,881
Largest session: 1,859 lines (566f037a-...)
Smallest session: 12 lines
```

**Format confirmed:** Matches spec expectations with:
- `type: "session"` header
- `type: "message"` with role/content structure  
- `type: "model_change"`, `type: "thinking_level_change"`, `type: "custom"` entries

### 5.2 Best Demo Sessions

For maximum visual impact, ideal demo session has:
- 15-50 prompts (enough nodes, not overwhelming)
- Mix of short and long prompts (varied node sizes)
- Multiple tool types used (colorful satellites)
- Some topic drift (interesting path angles)
- Moderate latency variance (visual distinction)

**Recommendation:** Pre-curate 2-3 demo sessions. The 1,859-line session (566f037a) is too large. Look for sessions in 100-300 line range.

### 5.3 What Would Break It

| Session Characteristic | Parser Behavior | Visual Result |
|------------------------|-----------------|---------------|
| All system messages, no user | `nodes = []` | Empty starmap |
| Very long prompts (10k+ chars) | Node radius maxes out | One huge node |
| Rapid-fire prompts (< 1s apart) | Latency shows 0 | Clustered timeline |
| Only tool results, no prompts | `nodes = []` | Empty starmap |
| Malformed JSON lines | Logged as error, continues | Missing nodes |
| Timestamps missing | Infers 1s intervals | Odd positioning |

---

## 6. UX GAPS: First-Time User Experience

### 6.1 Onboarding Issues

1. **No help text explaining what nodes represent**
   - First-time user sees shapes but doesn't know "bigger = more complex"
   
2. **No legend for satellite colors**
   - What does the orange cube mean? The purple sphere?
   
3. **No zoom instructions**
   - Mouse wheel zooms but not indicated anywhere
   
4. **File picker feels hidden**
   - "Load Session" button in corner, easy to miss

### 6.2 Navigation Confusion

1. **Current node not obviously highlighted**
   - Active state is brighter, but subtle
   
2. **No minimap or overview indicator**
   - Lost in large sessions
   
3. **Can't search for prompts**
   - Would be useful for "where was I talking about X?"

### 6.3 Details Panel Issues

1. **No copy button for prompt text**
   - Can't easily grab the actual prompt
   
2. **Metrics lack context**
   - "Complexity: 73" means nothing without scale
   - Add "High" / "Low" labels or percentile

3. **No "view response" link**
   - Shows prompt, not what the assistant said

---

## 7. PERFORMANCE: Potential Bottlenecks

### 7.1 Identified Risks

| Location | Issue | Impact |
|----------|-------|--------|
| `animateSatellites()` | Called for ALL satellites every frame | O(n) per frame |
| `animatePathPulse()` | Called for ALL paths every frame | O(n) per frame |
| `updateAllVisualStates()` | Iterates all nodes + paths | O(2n) on navigation |
| Path geometry | Creates new BufferGeometry during draw animation | Memory churn |
| Node birth animation | Stores animation objects in array, filtered each frame | Array overhead |

### 7.2 Memory Leak Candidates

1. **Event handlers not cleaned up** on dispose
   - `document.addEventListener('keydown', ...)` in navigation
   - Needs corresponding `removeEventListener` in `dispose()`

2. **pathObjects Map** retains references
   - Fixed: `disposePath()` clears geometry/material ✅

3. **Animations array** grows unbounded
   - Fixed: Filters out `isComplete` animations ✅

### 7.3 Recommendations

1. Add `requestAnimationFrame` throttling for non-active satellites
2. Use object pools for pulse particles
3. Batch material updates instead of per-node

---

## 8. POLISH: Small Touches for Big Impact

### 8.1 Quick Wins (< 30 min each)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Add keyboard shortcut hints to buttons | 5 min | Medium |
| Pulse active node slightly on navigation | 15 min | High |
| Add "Session loaded: X prompts" toast | 10 min | Medium |
| Show satellite labels on hover | 20 min | High |
| Add complexity legend in header | 15 min | Medium |
| Animate header badges on value change | 10 min | Low |

### 8.2 Medium Effort (1-2 hours)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Add "follow" camera mode | 1.5 hr | High |
| Implement session search/filter | 2 hr | Medium |
| Add export as image/screenshot | 1 hr | Medium |
| Dark/light mode toggle | 2 hr | Low |

### 8.3 Nice-to-Haves (Later)

| Enhancement | Effort | Impact |
|-------------|--------|--------|
| Real-time session streaming | 4+ hr | Very High |
| Session comparison view | 4+ hr | Medium |
| Embeddings-based similarity | 2+ hr | Medium |

---

## 9. CRITICAL BLOCKERS (Must Fix Before Demo)

### 🔴 Blocker #1: No Package.json / Build Config

**Impact:** Project cannot be installed or built.

**Fix:** Create minimal package.json:
```json
{
  "name": "prompt-quant-visualizer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "three": "^0.162.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

### 🔴 Blocker #2: Import Path Mismatch

**Impact:** Widget can't load renderer.

**File:** `src/ui/widget.js` line 104
```javascript
// Wrong:
const vizModule = await import('../viz/starmap-renderer.js')
// Should be:
const vizModule = await import('../viz/starmap.js')
```

Also need to update class export:
```javascript
// In starmap.js, add at end:
export { StarmapRenderer };
```

### 🔴 Blocker #3: Session Path Wrong in Parser

**Impact:** Parser looks for sessions in wrong location.

**Spec says:** `~/.openclaw/sessions/*.jsonl`
**Reality:** `~/.openclaw/agents/main/sessions/*.jsonl`

**Fix:** Update BRIEF.md and any hardcoded paths.

---

## 10. VERDICT & RECOMMENDATIONS

### For Tomorrow Morning Demo:

1. **Create package.json + vite.config.ts** (30 min)
2. **Fix import path mismatch** (5 min)
3. **Pre-select a good demo session** (15 min)
4. **Add node labels on hover** (20 min)
5. **Test with actual session data** (30 min)

### For Live-Desktop Integration:

1. Finish standalone first (above items)
2. Create the embed module per spec §8
3. Test with bloom disabled initially
4. Add to live-desktop behind feature flag
5. Iterate on positioning/scaling

### For "Impressive Demo":

1. Pick Aurora color palette (it pops more)
2. Add camera transition easing
3. Show satellite labels
4. Animate the loading state
5. Curate 2-3 compelling sessions that tell a story

---

## Appendix A: File Inventory

```
projects/prompt-quant-visualizer/
├── BRIEF.md                    ✅ Complete
├── docs/
│   ├── art-direction-aurora.md  ✅ Complete
│   ├── art-direction-codex.md   ✅ Complete  
│   ├── BUILD-LOG.md             ✅ Tracking
│   ├── metrics-spec.md          ✅ Complete
│   ├── SPEC.md                  ✅ Complete
│   └── WILDCARD-1.md            📝 This file
├── public/
│   ├── index.html               ✅ Complete
│   └── style.css                ✅ Complete (~800 lines)
├── src/
│   ├── data/
│   │   ├── parser.js            ✅ Complete
│   │   ├── metrics.js           ✅ Complete
│   │   └── index.js             ✅ Exports
│   ├── viz/
│   │   ├── starmap.js           ✅ Complete (rename needed?)
│   │   ├── nodes.js             ✅ Complete
│   │   ├── satellites.js        ✅ Complete
│   │   ├── paths.js             ✅ Complete
│   │   └── index.js             ✅ Exports
│   ├── ui/
│   │   ├── widget.js            ⚠️ Import path wrong
│   │   ├── navigation.js        ✅ Complete
│   │   ├── details-panel.js     ✅ Complete
│   │   └── index.js             ✅ Exports
│   └── integration/
│       └── (MISSING)            ❌ live-desktop-embed.ts needed
├── test/
│   └── (EMPTY)                  ⚠️ No tests
├── package.json                 ❌ MISSING
├── vite.config.ts               ❌ MISSING
└── tsconfig.json                ❌ MISSING (using JS anyway)
```

---

*End of WILDCARD-1 Report*

**TL;DR:** Great architecture, solid implementation, but can't run without package.json. Fix the three blockers, add hover labels, and it's demo-ready.
