# QA Report — Prompt Quant Visualizer

**Reviewer:** PQV-QAReviewer  
**Date:** 2026-02-11  
**Status:** Review Complete

---

## Summary

**Ready for Integration:** ❌ NO

**Blockers:**
1. Missing module import paths (widget cannot load renderer or parser)
2. Missing `package.json` (dependencies cannot be installed)
3. Browser/Node.js environment mismatch in parser

---

## Critical Issues (Must Fix)

### C1. ❌ Wrong Import Path: `starmap-renderer.js` Does Not Exist

**Location:** `src/ui/widget.js` line ~127
```javascript
const vizModule = await import('../viz/starmap-renderer.js').catch(() => null);
```

**Problem:** The file is named `starmap.js`, not `starmap-renderer.js`. The SPEC references `starmap-renderer.ts` but implementation uses `starmap.js`.

**Fix:** Change import path:
```javascript
const vizModule = await import('../viz/starmap.js').catch(() => null);
```

---

### C2. ❌ Wrong Import Path: `session-parser.js` Does Not Exist

**Location:** `src/ui/widget.js` line ~162
```javascript
const dataModule = await import('../data/session-parser.js').catch(() => null);
```

**Problem:** The file is named `parser.js`, not `session-parser.js`.

**Fix:** Change import path:
```javascript
const dataModule = await import('../data/parser.js').catch(() => null);
```

---

### C3. ❌ Missing `package.json`

**Problem:** No `package.json` exists in the project root. Cannot install dependencies (Three.js, etc.) or run any npm scripts.

**Impact:** 
- `npm install` will fail
- `import * as THREE from 'three'` will fail
- Project cannot be built or run

**Fix:** Create `package.json`:
```json
{
  "name": "prompt-quant-visualizer",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
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

---

### C4. ❌ `require()` Used in ES Module

**Location:** `src/data/index.js` line ~49
```javascript
const { parseSessionFromString } = require('./parser.js');
```

**Problem:** Using CommonJS `require()` in an ES module file (has `export` statements). This will throw a runtime error.

**Fix:** Change to dynamic import or remove the default export wrapper:
```javascript
parseSessionFromString: (content, sessionId) => {
  // Import synchronously from already-loaded module
  const { parseSessionFromString } = await import('./parser.js');
  return parseSessionFromString(content, sessionId);
}
```

Or better, just directly export the function:
```javascript
export { parseSessionFromString } from './parser.js';
```

---

### C5. ❌ Node.js-Only API in Browser Code

**Location:** `src/data/parser.js` line ~1
```javascript
import { readFile } from 'fs/promises';
```

**Problem:** `fs/promises` is a Node.js API. The parser is expected to run in the browser (via the widget), but `fs` is not available there.

**Impact:** `parseSession(path)` will fail in browser with "Cannot find module 'fs/promises'".

**Fix Options:**
1. Make parser browser-compatible (use `fetch` instead of `readFile`)
2. Or use conditional loading:
```javascript
export async function parseSession(jsonlPath) {
  let content;
  
  // Browser environment
  if (typeof window !== 'undefined') {
    const response = await fetch(jsonlPath);
    if (!response.ok) {
      return {
        success: false,
        nodes: [],
        meta: createEmptyMeta(jsonlPath),
        errors: [{ line: 0, message: `HTTP ${response.status}: ${response.statusText}` }]
      };
    }
    content = await response.text();
  } else {
    // Node.js environment
    const { readFile } = await import('fs/promises');
    content = await readFile(jsonlPath, 'utf-8');
  }
  // ... rest of parsing
}
```

---

### C6. ❌ Satellite Visibility Assignment Bug

**Location:** `src/viz/starmap.js` line ~408
```javascript
this.nodeObjects.forEach(({ satellites }) => {
  if (satellites) {
    satellites.visible = satellites;  // BUG: assigning object to itself
  }
});
```

**Problem:** `satellites.visible = satellites` assigns the group to its own visibility property (should be `true`/`false`).

**Fix:**
```javascript
setVisibility({ connections = true, satellites: showSatellites = true, labels = true, grid = true } = {}) {
  if (this.pathsGroup) {
    this.pathsGroup.visible = connections;
  }
  
  // Toggle satellites on each node
  this.nodeObjects.forEach(({ satellites }) => {
    if (satellites) {
      satellites.visible = showSatellites;  // Use renamed parameter
    }
  });
  // ...
}
```

---

## Warnings (Should Fix)

### W1. ⚠️ Keyboard Event Listener Not Properly Bound

**Location:** `src/ui/navigation.js` line ~57
```javascript
document.addEventListener('keydown', this._handleKeydown.bind(this));
```

**Location:** `src/ui/navigation.js` line ~178 (dispose)
```javascript
document.removeEventListener('keydown', this._handleKeydown);
```

**Problem:** `bind()` creates a new function each time, so `removeEventListener` won't find the original listener.

**Fix:** Store the bound reference:
```javascript
// In constructor or _bindEvents:
this._boundHandleKeydown = this._handleKeydown.bind(this);
document.addEventListener('keydown', this._boundHandleKeydown);

// In dispose:
document.removeEventListener('keydown', this._boundHandleKeydown);
```

---

### W2. ⚠️ Same Issue in `details-panel.js`

**Location:** `src/ui/details-panel.js` lines ~84, ~86
```javascript
document.addEventListener('keydown', this._handleKeydown.bind(this));
document.addEventListener('click', this._handleOutsideClick.bind(this));
```

**Fix:** Same as W1 — store bound references and use them in `dispose()`.

---

### W3. ⚠️ SPEC Naming Mismatch

**SPEC.md specifies:**
- `src/data/session-parser.ts`
- `src/data/metrics-calculator.ts`
- `src/viz/starmap-renderer.ts`

**Implementation has:**
- `src/data/parser.js`
- `src/data/metrics.js`
- `src/viz/starmap.js`

**Impact:** Confusion for developers referencing SPEC. The widget.js was written referencing SPEC names.

**Fix:** Either rename files to match SPEC, or update SPEC to reflect actual names. Recommend updating SPEC since files are already implemented.

---

### W4. ⚠️ Missing Vite Config

**Problem:** SPEC mentions `vite.config.ts` but no such file exists. Project will work with Vite defaults, but explicit config is better for production.

**Fix:** Create `vite.config.js`:
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  base: './',
  publicDir: '../public/assets',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

---

### W5. ⚠️ Missing TypeScript Config

**SPEC mentions TypeScript** but all files are JavaScript. This is fine for MVP but noted for completeness.

---

### W6. ⚠️ Hardcoded Default Theme Duplication

**Locations:** 
- `src/viz/starmap.js` — `DEFAULT_THEME`
- `src/viz/index.js` — `DEFAULT_THEME`
- `src/ui/widget.js` — inline theme object

**Problem:** Theme is defined in 3 places. Updates won't be synchronized.

**Fix:** Export from one canonical location and import elsewhere:
```javascript
// In starmap.js:
export const DEFAULT_THEME = { ... };

// In widget.js:
import { DEFAULT_THEME } from '../viz/starmap.js';
```

---

### W7. ⚠️ Missing Error Boundary in Renderer Init

**Location:** `src/ui/widget.js` line ~123
```javascript
async _initRenderer() {
  try {
    const vizModule = await import('../viz/starmap-renderer.js').catch(() => null);
    // ...
  } catch (err) {
    console.warn('StarmapRenderer not available:', err);
    this._showPlaceholder();
  }
}
```

**Problem:** If `StarmapRenderer.mount()` throws, the error is not caught and widget may be in broken state.

**Fix:** Wrap renderer initialization in try-catch:
```javascript
if (vizModule && vizModule.StarmapRenderer) {
  try {
    this.renderer = new vizModule.StarmapRenderer(this.options.renderer);
    this.renderer.mount(this.elements.viewport);
    // ... event bindings
  } catch (err) {
    console.error('Failed to initialize renderer:', err);
    this._emit('error', { error: err, context: 'initRenderer' });
    this._showPlaceholder();
    return;
  }
}
```

---

## Suggestions (Nice to Have)

### S1. 💡 Add `src/index.js` Entry Point

Create a main entry point that exports all public APIs:
```javascript
// src/index.js
export * from './data/index.js';
export * from './viz/index.js';
export * from './ui/index.js';
```

---

### S2. 💡 Add Loading State to Details Panel

When navigating between nodes, show a brief loading indicator in the details panel metrics section.

---

### S3. 💡 Add Keyboard Shortcut Documentation

The navigation supports `Home`, `End`, `1-9` keys but these aren't documented. Add to README or a help tooltip.

---

### S4. 💡 Add Accessibility ARIA Live Region

When node changes, announce via ARIA for screen readers:
```javascript
// In widget.js goToNode():
const announcement = document.getElementById('pqv-aria-announcer');
if (announcement) {
  announcement.textContent = `Viewing prompt ${index + 1} of ${this.nodes.length}`;
}
```

---

### S5. 💡 Export TOOL_CATEGORIES Constant

**Location:** `src/data/metrics.js`

The `TOOL_CATEGORIES` object might be useful for consumers (e.g., for UI legends).

```javascript
export const TOOL_CATEGORIES = { ... };
```

---

### S6. 💡 Add JSDoc Type Exports

The index files have JSDoc typedefs but they're not importable in IDE. Consider creating a `types.d.ts` for better TypeScript/IDE support.

---

### S7. 💡 Demo Data Could Be External

**Location:** `public/index.html` inline script

The demo prompts are hardcoded. Consider moving to a `fixtures/demo-session.jsonl` file for easier editing.

---

## File-by-File Checklist

| File | Syntax | Imports | Exports | Logic | Status |
|------|--------|---------|---------|-------|--------|
| `src/data/parser.js` | ✅ | ⚠️ fs | ✅ | ✅ | Needs fix C5 |
| `src/data/metrics.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `src/data/index.js` | ✅ | ✅ | ❌ require | ✅ | Needs fix C4 |
| `src/viz/starmap.js` | ✅ | ✅ | ✅ | ⚠️ | Needs fix C6 |
| `src/viz/nodes.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `src/viz/satellites.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `src/viz/paths.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `src/viz/index.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `src/ui/navigation.js` | ✅ | ✅ | ✅ | ⚠️ | Needs fix W1 |
| `src/ui/details-panel.js` | ✅ | ✅ | ✅ | ⚠️ | Needs fix W2 |
| `src/ui/widget.js` | ✅ | ❌ wrong paths | ✅ | ✅ | Needs fix C1, C2 |
| `src/ui/index.js` | ✅ | ✅ | ✅ | ✅ | OK |
| `public/index.html` | ✅ | ✅ | N/A | ✅ | OK |
| `public/style.css` | ✅ | N/A | N/A | N/A | OK |
| `package.json` | ❌ Missing | — | — | — | Needs fix C3 |

---

## Integration Test Checklist

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| npm install | Dependencies install | Cannot test | ❌ C3 |
| npm run dev | Vite server starts | Cannot test | ❌ C3 |
| Load index.html | Widget renders | Will fail | ❌ C1, C2, C5 |
| Load demo data | Nodes appear | Partial (placeholder only) | ⚠️ |
| Click node | Details panel opens | Expected to work | — |
| Navigate with arrows | Focus changes | Expected to work | — |
| Keyboard nav (←→) | Focus changes | Expected to work | — |
| Load .jsonl file | Parses correctly | Browser: ❌ C5 | ❌ |

---

## Priority Order for Fixes

1. **C3** — Create `package.json` (unblocks everything)
2. **C1, C2** — Fix import paths in widget.js
3. **C5** — Make parser browser-compatible
4. **C4** — Remove `require()` from ES module
5. **C6** — Fix satellite visibility bug
6. **W1, W2** — Fix event listener leaks
7. **W4** — Add vite.config.js
8. **W6** — Consolidate theme definitions

---

## Conclusion

The implementation is **architecturally sound** and follows the SPEC well. However, there are 6 critical issues that prevent the project from running. The most impactful are:

1. Missing `package.json` — project cannot be initialized
2. Wrong import paths — widget can't find renderer/parser
3. Node.js `fs` module used in browser context

Once these are fixed, the project should be functional. The code quality is good, Three.js integration looks correct, and the UI components are well-structured.

**Estimated time to fix all critical issues:** 1-2 hours

---

*Report generated by PQV-QAReviewer*
