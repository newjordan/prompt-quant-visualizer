# WILDCARD-2: Deep Code & Polish Review

**Investigator:** Wildcard #2 (Claude Opus 4)  
**Date:** 2026-02-11 03:10 CST  
**Status:** Complete  
**Focus:** Code quality, CSS polish, event wiring, error handling, accessibility, mobile, memory leaks

---

## Executive Summary

Wildcard #1 caught the critical blockers (missing package.json, import path mismatch). This review goes deeper into **code correctness, memory safety, and accessibility** — things that could cause subtle runtime failures or hurt the demo experience.

**Overall Assessment:** 🟡 **Fixable in 30 minutes if prioritized**

---

## 1. CRITICAL BUGS (Will Break Runtime)

### 🔴 Bug #1: Second Import Path Mismatch (W1 MISSED THIS!)

**Location:** `src/ui/widget.js` line ~168

```javascript
// WRONG:
const dataModule = await import('../data/session-parser.js').catch(() => null);

// SHOULD BE:
const dataModule = await import('../data/parser.js').catch(() => null);
```

**Impact:** Widget's `loadSession()` will silently fail and fall through to the manual parser.

---

### 🔴 Bug #2: CommonJS in ES Module

**Location:** `src/data/index.js` line 49

```javascript
// BROKEN (CommonJS syntax in ES module):
const { parseSessionFromString } = require('./parser.js');

// SHOULD BE:
import { parseSessionFromString } from './parser.js';
```

**Impact:** Will throw `ReferenceError: require is not defined` in browsers.

---

### 🔴 Bug #3: Logic Error in setVisibility()

**Location:** `src/viz/starmap.js` line ~407

```javascript
// WRONG (assigns object to its own property):
satellites.visible = satellites;

// SHOULD BE:
if (satellites) {
  satellites.group.visible = satellites; // or just use the param directly
}
```

Actually, looking more carefully — the whole function is bugged:

```javascript
setVisibility({ connections = true, satellites = true, labels = true, grid = true } = {}) {
  // ...
  this.nodeObjects.forEach(({ satellites }) => {  // shadows outer 'satellites' param!
    if (satellites) {
      satellites.visible = satellites;  // assigns object to itself
    }
  });
}
```

**Fix:**
```javascript
setVisibility({ connections = true, satellites: showSatellites = true, labels = true, grid = true } = {}) {
  // ...
  this.nodeObjects.forEach(({ satellites }) => {
    if (satellites) {
      satellites.visible = showSatellites;
    }
  });
}
```

---

## 2. MEMORY LEAKS (Event Handlers)

### ⚠️ Leak #1: Navigation Event Handler

**Location:** `src/ui/navigation.js`

**Problem:** Uses `.bind(this)` when adding listener but tries to remove unbound method:

```javascript
// In _bindEvents():
document.addEventListener('keydown', this._handleKeydown.bind(this));

// In dispose():
document.removeEventListener('keydown', this._handleKeydown);  // WRONG - different reference!
```

**Fix:** Store the bound function:
```javascript
constructor() {
  // ...
  this._boundKeydown = this._handleKeydown.bind(this);
}

_bindEvents() {
  document.addEventListener('keydown', this._boundKeydown);
}

dispose() {
  document.removeEventListener('keydown', this._boundKeydown);
}
```

---

### ⚠️ Leak #2: Details Panel Event Handlers

**Location:** `src/ui/details-panel.js`

**Same issue** with `_handleKeydown` and `_handleOutsideClick`:

```javascript
// _bindEvents():
document.addEventListener('keydown', this._handleKeydown.bind(this));
document.addEventListener('click', this._handleOutsideClick.bind(this));

// dispose():
document.removeEventListener('keydown', this._handleKeydown);      // WRONG
document.removeEventListener('click', this._handleOutsideClick);   // WRONG
```

---

### ⚠️ Leak #3: Starmap Pointer Events

**Location:** `src/viz/starmap.js` — `setupEventListeners()`

**Problem:** Adds pointer events but never removes them in `dispose()`:

```javascript
setupEventListeners() {
  // ...
  this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove.bind(this));
  this.renderer.domElement.addEventListener('click', this.handleClick.bind(this));
}

dispose() {
  // ❌ Missing: removal of pointermove and click handlers
}
```

---

## 3. ACCESSIBILITY GAPS

### 🟡 Missing Focus-Visible Styles

**Location:** `public/style.css`

**Problem:** Keyboard users cannot see focus state. Add:

```css
/* Focus states for keyboard navigation */
.pqv-nav__btn:focus-visible,
.pqv-details__close:focus-visible,
.pqv-details__nav-btn:focus-visible,
.pqv-nav__timeline-dot:focus-visible,
.pqv-placeholder__node:focus-visible {
  outline: 2px solid var(--pqv-cyan);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--pqv-glow-primary);
}

.pqv-file-input__btn:focus-within {
  border-color: var(--pqv-cyan);
  box-shadow: 0 0 16px var(--pqv-glow-primary);
}
```

**Effort:** 5 minutes  
**Impact:** High (accessibility compliance)

---

### 🟡 No Screen Reader Announcements

**Problem:** When navigating between nodes, screen readers don't know anything changed.

**Quick Fix:** Add a live region in widget.js:

```javascript
// In _createStructure():
const announcer = document.createElement('div');
announcer.className = 'sr-only';
announcer.setAttribute('role', 'status');
announcer.setAttribute('aria-live', 'polite');
this.container.appendChild(announcer);
this.elements.announcer = announcer;

// In goToNode():
if (this.elements.announcer) {
  this.elements.announcer.textContent = `Prompt ${index + 1} of ${this.nodes.length}`;
}
```

And in CSS:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## 4. CSS POLISH GAPS

### 🟡 Missing Loading State Transition

When file is being loaded, no visual feedback. The loading spinner never reappears.

**Fix in widget.js:**
```javascript
async loadSession(jsonlPath) {
  this.elements.canvasPlaceholder.style.display = 'flex';  // Show spinner
  // ... existing code
}
```

---

### 🟡 Details Panel Scrollbar on Body

When details panel is open and has overflow, sometimes the body scrolls too.

**Fix:**
```css
.pqv-details--visible .pqv-details__inner {
  overscroll-behavior: contain;
}
```

---

### 🟡 Timeline Track Needs Min-Width

On very small sessions, timeline is too narrow.

Already has `min-width: 200px` — but check it's being respected on mobile.

---

## 5. DEMO QUICK WINS

### ✨ Delighter #1: Copy Prompt Button (10 min)

Add a copy button to details panel:

```javascript
// In _createElement(), after prompt-content:
<button class="pqv-details__copy-btn" aria-label="Copy prompt text">
  <svg>...</svg>
</button>

// Handler:
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(this.currentNode.text);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = 'Copy', 1500);
});
```

---

### ✨ Delighter #2: Node Labels on Hover (Already in WILDCARD-1)

W1 mentioned this. Still the highest-impact visual improvement.

---

### ✨ Delighter #3: Keyboard Shortcut Toast

Show a "Press ? for shortcuts" toast on first load:

```javascript
// In mount():
setTimeout(() => {
  this._showToast('Press ? for keyboard shortcuts');
}, 2000);
```

---

## 6. ART DIRECTION RECOMMENDATION

**Recommendation: Use Aurora palette**

Reasons:
1. **Aurora's gold satellites** (0xFFD700) pop more against the cyan nodes than Codex's green
2. **Warmer highlights** make it feel more alive, less sterile
3. **The purple drift indicator** in Aurora (0x9333EA) contrasts better with blue paths

**Quick theme switch in widget.js options:**
```javascript
theme: {
  satelliteColors: {
    length: 0x00AAFF,     // Keep blue
    tools: 0xFFD700,      // Aurora gold (was green)
    latency: 0xFF6B6B,    // Aurora coral (was red)
    drift: 0x9333EA,      // Aurora violet (was purple)
  }
}
```

---

## 7. PRIORITY FIX ORDER

For the Integrator in the next 15 minutes:

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Fix `session-parser.js` → `parser.js` import | 1 min | Demo breaks without |
| **P0** | Fix `require()` → `import` in data/index.js | 1 min | Demo breaks without |
| **P0** | Fix `setVisibility()` variable shadowing | 2 min | Feature broken |
| **P1** | Fix memory leaks (bind references) | 10 min | Stability |
| **P1** | Add focus-visible styles | 5 min | Accessibility |
| **P2** | Add screen reader announcements | 5 min | Accessibility |
| **P2** | Switch to Aurora satellite colors | 2 min | Visual polish |

---

## 8. SINGLE MOST IMPACTFUL QUICK FIX

**Fix the three P0 bugs above.**

Without them, the demo literally won't work. With them fixed, everything else is polish.

If you have 5 more minutes after P0s: **add focus-visible styles**. It's CSS-only and makes the whole thing feel more professional.

---

## Appendix: All File Issues

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `src/ui/widget.js` | ~168 | Wrong import path `session-parser.js` | 🔴 |
| `src/data/index.js` | 49 | Uses `require()` in ES module | 🔴 |
| `src/viz/starmap.js` | ~407 | Variable shadowing + self-assignment | 🔴 |
| `src/ui/navigation.js` | dispose | Event handler leak | ⚠️ |
| `src/ui/details-panel.js` | dispose | Event handler leak (x2) | ⚠️ |
| `src/viz/starmap.js` | dispose | Missing pointer event cleanup | ⚠️ |
| `public/style.css` | — | Missing focus-visible styles | 🟡 |

---

*End of WILDCARD-2 Report*

**TL;DR:** Three code bugs will break the demo. Fix `parser.js` import, `require()` → `import`, and `setVisibility()` shadowing. Then add focus styles. Aurora palette recommended.
