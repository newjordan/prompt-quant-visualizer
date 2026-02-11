# Prompt Quant Visualizer — Usage Guide

A detailed guide to loading sessions, navigating the visualization, and embedding in other projects.

---

## Table of Contents

1. [Loading a Session File](#loading-a-session-file)
2. [Navigation](#navigation)
3. [Understanding the Visualization](#understanding-the-visualization)
4. [Customization](#customization)
5. [Embedding in Other Projects](#embedding-in-other-projects)
6. [API Reference](#api-reference)

---

## Loading a Session File

### Supported Formats

The visualizer accepts OpenClaw session transcripts in JSONL format (`.jsonl` or `.json`):

```jsonl
{"role":"user","content":"What's the weather?","timestamp":"2026-02-11T01:00:00Z"}
{"role":"assistant","content":"Let me check...","tool_calls":[{"name":"web_search"}]}
{"role":"user","content":"Thanks! Now summarize this article...","timestamp":"2026-02-11T01:01:30Z"}
```

**Parsing Rules:**
- Only `role: "user"` lines become visible nodes
- Each user message pairs with the next assistant message for latency/tool extraction
- Missing timestamps are inferred from line order
- Invalid JSON lines are skipped (logged to console)

### Loading Methods

#### 1. File Picker Button
Click **"Load Session"** in the UI or press `Ctrl+O`.

#### 2. URL Parameter
```
http://localhost:5173?session=/path/to/session.jsonl
```

#### 3. Programmatic Loading
```javascript
// From file path
await widget.loadSession('/sessions/my-session.jsonl');

// From parsed nodes array
widget.loadNodes(myParsedNodes);
```

#### 4. Drag and Drop
Drag a `.jsonl` file onto the viewport (if implemented in your version).

---

## Navigation

### Mouse Controls

| Action | Result |
|--------|--------|
| **Click node** | Focus node + open details panel |
| **Hover node** | Highlight node, show tooltip |
| **Click empty space** | Close details panel |
| **Scroll wheel** | Zoom in/out (in 3D mode) |
| **Left drag** | Orbit camera |
| **Right drag** | Pan camera |

### Keyboard Controls

| Key | Action |
|-----|--------|
| `←` Arrow Left | Previous node |
| `→` Arrow Right | Next node |
| `↑` Arrow Up | Previous node |
| `↓` Arrow Down | Next node |
| `Home` | Jump to first node (index 0) |
| `End` | Jump to last node |
| `Page Up` | Jump back 10 nodes |
| `Page Down` | Jump forward 10 nodes |
| `Escape` | Close details panel |
| `Ctrl+O` / `Cmd+O` | Open file picker |
| `Space` | Toggle autoplay mode |

### Navigation UI Elements

**Timeline Bar:** Mini dots at the bottom representing all nodes. Click any dot to jump directly.

**Counter:** Shows current position, e.g., `5 / 24`.

**Prev/Next Arrows:** Large chevron buttons on either side.

---

## Understanding the Visualization

### Node Shapes

The primary node shape indicates complexity:

| Complexity | Shape | Faces |
|------------|-------|-------|
| 0–33 (Low) | Icosahedron | 20 |
| 34–66 (Medium) | Octahedron | 8 |
| 67–100 (High) | Dodecahedron | 12 |

All shapes render as glowing wireframes with additive blending.

### Node States

| State | Appearance |
|-------|------------|
| **Default** | Cyan wireframe (`#00FFCC`) |
| **Active (focused)** | Brighter cyan (`#00FFFF`) + pulse animation |
| **Hovered** | Soft glow expansion (`#66FFEE`) |
| **Historical** | Faded when far from current position |

### Connection Splines

Thin bezier curves connect nodes in sequence, showing your conversation journey:

- **Pulse Animation:** Data packets travel along splines toward active node
- **Opacity:** Recent connections are brighter; older ones fade
- **Curvature:** Controlled by `pathCurvature` option (0 = straight, 1 = very curved)

### Satellites (Metric Indicators)

Each node has up to 4 orbiting satellites representing metrics:

| Satellite | Color | Shape | Represents |
|-----------|-------|-------|------------|
| Token/Length | Blue (`#00AAFF`) | Sphere | Character/word count |
| Tool Usage | Orange (`#FFAA00`) | Cube | Number of tools called |
| Latency | Red (`#FF5A5A`) | Tetrahedron | Response wait time |
| Topic Drift | Purple (`#AA44FF`) | Sphere | Semantic shift from previous |

**Satellite Size:** Scales with metric value (larger = higher value).

**Orbit Direction:** Alternates to create visual interest.

---

## Customization

### Layout Modes

```javascript
renderer: {
  layout: 'path'  // Options: 'path' | 'cluster' | 'spiral'
}
```

| Layout | Description |
|--------|-------------|
| `path` | Linear journey with gentle curves (default) |
| `cluster` | Grouped by topic similarity |
| `spiral` | Logarithmic spiral outward from center |

### Visibility Toggles

```javascript
renderer.setVisibility({
  connections: true,   // Spline paths
  satellites: true,    // Orbiting metrics
  labels: false,       // Text labels on nodes
  grid: false          // Background reference grid
});
```

### Theme Presets

**Frost (Default):**
```javascript
theme: {
  nodeColor: 0x00ffcc,
  backgroundColor: 0x0a0a0f
}
```

**Warm:**
```javascript
theme: {
  nodeColor: 0xffaa44,
  nodeColorActive: 0xffd700,
  connectionColor: 0xff8800,
  backgroundColor: 0x1a0a0a
}
```

**Monochrome:**
```javascript
theme: {
  nodeColor: 0xcccccc,
  nodeColorActive: 0xffffff,
  connectionColor: 0x888888,
  backgroundColor: 0x111111,
  satelliteColors: {
    length: 0xaaaaaa,
    tools: 0xcccccc,
    latency: 0x999999,
    drift: 0xbbbbbb
  }
}
```

### Glow Effects

```javascript
renderer: {
  enableGlow: true  // WebGL post-processing bloom
}
```

> **Note:** Glow is disabled when embedded as CSS3DObject (incompatible with CSS3DRenderer).

---

## Embedding in Other Projects

### As a Standalone Widget

```html
<div id="pqv-container" style="width: 800px; height: 600px;"></div>

<script type="module">
  import { PromptQuantWidget } from './src/ui/index.js';
  
  const widget = new PromptQuantWidget({
    showHeader: true,
    title: 'Session Starmap'
  });
  
  widget.mount(document.getElementById('pqv-container'));
  
  // Load data
  await widget.loadSession('/api/sessions/latest.jsonl');
</script>
```

### In Live-Desktop (CSS3DObject)

```javascript
import { createEmbeddedWidget, parseSession } from './vendor/prompt-quant-visualizer/index.js';

// Create embedded widget
const pqvWidget = createEmbeddedWidget(scene, {
  width: 700,
  height: 500,
  
  // 3D positioning in scene
  x: -860,
  y: 200,
  z: 50,
  rotX: -0.002,
  rotY: 0.003,
  rotZ: 0.001,
  
  // Renderer options
  starmapOptions: {
    layout: 'path',
    enableGlow: false  // Must be false for CSS3D
  }
});

// Load session
const result = await parseSession('/sessions/latest.jsonl');
if (result.success) {
  pqvWidget.renderer.setNodes(result.nodes);
}

// Connect to neural network lines
windowObjects.set('PROMPT.QUANT.STARMAP', pqvWidget.css3dObject);
```

### As ES Module

```bash
npm run bundle:embed
```

Produces `dist/embed/pqv.esm.js` — a single-file ES module:

```javascript
import { PromptQuantWidget, parseSession, StarmapRenderer } from './pqv.esm.js';
```

---

## API Reference

### `PromptQuantWidget`

The main widget class that orchestrates all components.

```typescript
class PromptQuantWidget {
  constructor(options?: WidgetOptions);
  
  // Lifecycle
  mount(container: HTMLElement): void;
  dispose(): void;
  
  // Data
  loadSession(jsonlPath: string): Promise<void>;
  loadNodes(nodes: PromptNode[]): void;
  getNodes(): PromptNode[];
  getMeta(): SessionMeta | null;
  
  // Navigation
  goToNode(index: number): void;
  goNext(): void;
  goPrev(): void;
  getCurrentNode(): PromptNode | null;
  
  // Components
  getRenderer(): StarmapRenderer | null;
  
  // Events
  on(event: WidgetEvent, handler: Function): void;
  off(event: WidgetEvent, handler: Function): void;
}
```

#### Widget Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `{ widget }` | Widget fully initialized |
| `session:loaded` | `{ nodes, meta }` | Session file parsed |
| `node:change` | `{ node, index }` | Focus changed |
| `node:click` | `{ node, index, screenPosition }` | Node clicked |
| `node:hover` | `{ node, index }` | Node hovered |
| `error` | `{ error, context }` | Error occurred |

---

### `StarmapRenderer`

Three.js visualization engine.

```typescript
class StarmapRenderer {
  constructor(options?: StarmapOptions);
  
  // Lifecycle
  mount(container: HTMLElement): void;      // Standalone mode
  embed(scene: THREE.Scene): THREE.Group;   // Returns Group for embedding
  dispose(): void;
  
  // Data
  setNodes(nodes: PromptNode[]): void;
  updateNode(id: string, partial: Partial<PromptNode>): void;
  
  // Navigation
  focusNode(index: number): void;
  getNodeAtPoint(screenX: number, screenY: number): PromptNode | null;
  
  // Appearance
  setTheme(theme: StarmapTheme): void;
  setVisibility(options: VisibilityOptions): void;
  
  // Events
  on(event: 'node:click' | 'node:hover' | 'node:leave' | 'focus:change' | 'ready', handler: Function): void;
}
```

---

### `parseSession`

Parse JSONL session files into PromptNode arrays.

```typescript
function parseSession(jsonlPath: string): Promise<ParseResult>;

interface ParseResult {
  success: boolean;
  nodes: PromptNode[];
  meta: SessionMeta;
  errors: ParseError[];  // Non-fatal issues
}
```

---

### `PromptNode` Interface

```typescript
interface PromptNode {
  // Identity
  id: string;
  index: number;
  
  // Content
  text: string;
  textPreview: string;  // First 120 chars + ellipsis
  timestamp: number;    // Unix ms
  
  // Metrics
  metrics: {
    charCount: number;
    wordCount: number;
    tokenEstimate: number;
    toolCallCount: number;
    toolTypes: string[];
    responseLatencyMs: number;
    similarityToPrev: number | null;
    topicDriftScore: number | null;
    complexityScore: number;  // 0-100
  };
  
  // Spatial (computed)
  position: { x: number; y: number; z: number };
  
  // Relationships
  prevId: string | null;
  nextId: string | null;
}
```

---

### `SessionMeta` Interface

```typescript
interface SessionMeta {
  sessionId: string;
  startTime: number;
  endTime: number;
  nodeCount: number;
  totalTokens: number;
  avgComplexity: number;
  maxComplexity: number;
  avgLatency: number;
  toolsUsed: string[];
}
```

---

## Troubleshooting

### "StarmapRenderer not available"

The 3D renderer module hasn't loaded. You'll see the placeholder visualization instead. Ensure:
- `src/viz/starmap-renderer.js` exists and exports `StarmapRenderer`
- No import errors in console

### Slow performance with many nodes

- Reduce `maxVisibleNodes` in renderer options
- Disable glow effects: `enableGlow: false`
- Use simpler layout: `layout: 'path'`

### Satellites not showing

- Check that metrics exist on your nodes
- Ensure `showSatellites` visibility is true
- Satellites with zero/null values may be hidden

### File won't load

- Verify JSONL format (one JSON object per line)
- Check for valid `role: "user"` entries
- Look for parse errors in browser console

---

*For technical details, see [SPEC.md](./SPEC.md).*
