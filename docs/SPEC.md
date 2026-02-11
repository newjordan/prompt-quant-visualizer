# Prompt Quant Visualizer — Technical Specification

**Version:** 1.0.0  
**Author:** Architect Agent  
**Date:** 2026-02-11  
**Status:** Implementation Ready

---

## 1. Overview

The Prompt Quant Visualizer renders conversation sessions as a 3D "traveled starmap" where each user prompt becomes a glowing node. Nodes are connected by spline paths showing conversation flow, with satellite extensions indicating prompt complexity metrics.

### 1.1 Design Principles

1. **Data-Driven Rendering** — All visualization driven by `PromptNode[]` array
2. **Stateless Components** — Components receive props, emit events, maintain no hidden state
3. **Live-Desktop Compatible** — Embeddable as CSS3DObject in existing Three.js scene
4. **Progressive Enhancement** — Works standalone first, integrates second

---

## 2. Data Model

### 2.1 PromptNode

The core data structure representing a single user prompt in the starmap.

```typescript
interface PromptNode {
  // === Identity ===
  id: string;                    // Unique identifier (uuid or session-index)
  index: number;                 // Sequential position in session (0-based)
  
  // === Content ===
  text: string;                  // Raw prompt text
  textPreview: string;           // Truncated preview (first 120 chars + ellipsis)
  timestamp: number;             // Unix timestamp (ms) when prompt was sent
  
  // === Metrics (satellites) ===
  metrics: PromptMetrics;
  
  // === Spatial (computed by viz engine) ===
  position: Vector3;             // x, y, z in world space
  
  // === Relationships ===
  prevId: string | null;         // Previous node id (null if first)
  nextId: string | null;         // Next node id (null if last)
}

interface PromptMetrics {
  // Token/length metrics
  charCount: number;             // Total characters
  wordCount: number;             // Word count (split on whitespace)
  tokenEstimate: number;         // Estimated tokens (chars / 4 heuristic)
  
  // Tool usage
  toolCallCount: number;         // Number of tools called in response
  toolTypes: string[];           // Unique tool names used
  
  // Timing
  responseLatencyMs: number;     // Time from prompt to first response byte
  
  // Semantic (optional, null if not computed)
  similarityToPrev: number | null;  // 0-1 cosine similarity to previous prompt
  topicDriftScore: number | null;   // 0-1 drift indicator (0=same topic, 1=complete shift)
  
  // Derived complexity score (0-100)
  complexityScore: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}
```

### 2.2 Session Metadata

```typescript
interface SessionMeta {
  sessionId: string;             // From .jsonl filename or content
  startTime: number;             // First prompt timestamp
  endTime: number;               // Last prompt timestamp
  nodeCount: number;             // Total prompts
  totalTokens: number;           // Sum of all tokenEstimates
  
  // Aggregate metrics
  avgComplexity: number;         // Mean complexity score
  maxComplexity: number;         // Peak complexity
  avgLatency: number;            // Mean response latency
  toolsUsed: string[];           // All unique tools across session
}
```

### 2.3 VisualizerState

```typescript
interface VisualizerState {
  nodes: PromptNode[];
  meta: SessionMeta;
  
  // Navigation
  currentIndex: number;          // Currently focused node index
  hoveredIndex: number | null;   // Node under cursor (null if none)
  
  // View
  cameraMode: 'orbit' | 'follow'; // Orbit = free, follow = tracks current node
  showConnections: boolean;
  showSatellites: boolean;
  showLabels: boolean;
}
```

---

## 3. Session Parser Interface

### 3.1 Module: `src/data/session-parser.ts`

```typescript
/**
 * Parse an OpenClaw session transcript into PromptNodes.
 * 
 * Input format: .jsonl where each line is a JSON object with:
 *   - role: "user" | "assistant" | "system"
 *   - content: string
 *   - timestamp?: string (ISO8601)
 *   - tool_calls?: object[]
 *   - tool_results?: object[]
 * 
 * @param jsonlPath - Path to .jsonl session file
 * @returns Promise<ParseResult>
 */
export async function parseSession(jsonlPath: string): Promise<ParseResult>;

interface ParseResult {
  success: boolean;
  nodes: PromptNode[];           // Only user messages become nodes
  meta: SessionMeta;
  errors: ParseError[];          // Non-fatal parse issues
}

interface ParseError {
  line: number;
  message: string;
  raw?: string;
}
```

### 3.2 Parsing Rules

1. **User Messages Only** — Only `role: "user"` lines become `PromptNode`
2. **Response Pairing** — Each user message pairs with next assistant message for latency/tools
3. **Timestamp Inference** — If no timestamp, infer from line order with 1s intervals
4. **Tool Extraction** — Count `tool_calls` array in paired assistant response
5. **Robust Fallback** — Invalid JSON lines logged, parsing continues

### 3.3 Example JSONL Structure

```jsonl
{"role":"user","content":"What's the weather?","timestamp":"2026-02-11T01:00:00Z"}
{"role":"assistant","content":"Let me check...","tool_calls":[{"name":"web_search"}],"timestamp":"2026-02-11T01:00:02Z"}
{"role":"user","content":"Thanks! Now summarize this article...","timestamp":"2026-02-11T01:01:30Z"}
```

---

## 4. Metrics Calculator Interface

### 4.1 Module: `src/data/metrics-calculator.ts`

```typescript
/**
 * Calculate all metrics for a prompt node.
 * 
 * @param text - The prompt text
 * @param prevText - Previous prompt text (null if first)
 * @param responseLatencyMs - Time to first response (from parser)
 * @param toolCalls - Array of tool call objects from response
 * @returns PromptMetrics
 */
export function calculateMetrics(
  text: string,
  prevText: string | null,
  responseLatencyMs: number,
  toolCalls: ToolCall[]
): PromptMetrics;

interface ToolCall {
  name: string;
  // Other fields ignored
}
```

### 4.2 Metric Calculations

| Metric | Formula | Notes |
|--------|---------|-------|
| `charCount` | `text.length` | Raw character count |
| `wordCount` | `text.split(/\s+/).filter(Boolean).length` | Whitespace split |
| `tokenEstimate` | `Math.ceil(charCount / 4)` | GPT-4 approximation |
| `toolCallCount` | `toolCalls.length` | Count from response |
| `toolTypes` | `[...new Set(toolCalls.map(t => t.name))]` | Unique tool names |
| `responseLatencyMs` | Passed from parser | Timestamp delta |
| `similarityToPrev` | `null` (MVP) | Optional: cosine via embeddings |
| `topicDriftScore` | `null` (MVP) | Optional: 1 - similarity |
| `complexityScore` | Weighted formula below | 0-100 scale |

### 4.3 Complexity Score Formula

```typescript
function calculateComplexity(m: Partial<PromptMetrics>): number {
  // Normalize each factor to 0-1 range
  const lengthFactor = Math.min(m.charCount / 2000, 1);        // Caps at 2000 chars
  const toolFactor = Math.min(m.toolCallCount / 5, 1);         // Caps at 5 tools
  const latencyFactor = Math.min(m.responseLatencyMs / 30000, 1); // Caps at 30s
  
  // Weighted combination
  const raw = (lengthFactor * 0.4) + (toolFactor * 0.35) + (latencyFactor * 0.25);
  
  return Math.round(raw * 100);
}
```

---

## 5. Visualization Component Contract

### 5.1 Module: `src/viz/starmap-renderer.ts`

```typescript
/**
 * Three.js-based starmap visualization.
 * Can render standalone or be embedded in existing Three.js scene.
 */
export class StarmapRenderer {
  constructor(options: StarmapOptions);
  
  // === Lifecycle ===
  mount(container: HTMLElement): void;    // Standalone: create canvas + render loop
  embed(scene: THREE.Scene): THREE.Group; // Embedded: return Group to add to scene
  dispose(): void;                        // Cleanup all resources
  
  // === Data ===
  setNodes(nodes: PromptNode[]): void;    // Replace entire node set
  updateNode(id: string, partial: Partial<PromptNode>): void;
  
  // === Navigation ===
  focusNode(index: number): void;         // Animate camera to node
  getNodeAtPoint(screenX: number, screenY: number): PromptNode | null;
  
  // === Appearance ===
  setTheme(theme: StarmapTheme): void;
  setVisibility(options: VisibilityOptions): void;
  
  // === Events ===
  on(event: StarmapEvent, handler: EventHandler): void;
  off(event: StarmapEvent, handler: EventHandler): void;
}

interface StarmapOptions {
  // Layout
  layout: 'path' | 'cluster' | 'spiral';  // How nodes are spatially arranged
  nodeSpacing: number;                     // Base distance between nodes (default: 100)
  pathCurvature: number;                   // 0-1, how curvy connections are (default: 0.3)
  
  // Appearance
  theme: StarmapTheme;
  
  // Performance
  maxVisibleNodes: number;                 // LOD cutoff (default: 200)
  enableGlow: boolean;                     // Post-processing glow (default: true)
}

interface StarmapTheme {
  // Node colors
  nodeColor: number;              // Default: 0x00ffcc (cyan)
  nodeColorActive: number;        // Focused node: 0x00ffff
  nodeColorHover: number;         // Hovered: 0x66ffee
  
  // Connection colors
  connectionColor: number;        // Spline: 0x00ffcc
  connectionOpacity: number;      // Default: 0.5
  
  // Satellite colors (per metric type)
  satelliteColors: {
    length: number;               // Token/length: 0x00aaff (blue)
    tools: number;                // Tool usage: 0xffaa00 (orange)
    latency: number;              // Response time: 0xff5a5a (red)
    drift: number;                // Topic drift: 0xaa44ff (purple)
  };
  
  // Background
  backgroundColor: number;        // Default: 0x0a0a0f (near-black)
}

interface VisibilityOptions {
  connections: boolean;
  satellites: boolean;
  labels: boolean;
  grid: boolean;
}

type StarmapEvent = 
  | 'node:click'      // User clicked a node
  | 'node:hover'      // Cursor entered a node
  | 'node:leave'      // Cursor left a node
  | 'focus:change'    // Current focused node changed
  | 'ready';          // Initial render complete

interface NodeEventPayload {
  node: PromptNode;
  index: number;
  screenPosition: { x: number; y: number };
}
```

### 5.2 Node Geometry

Each prompt node consists of:

```typescript
// Primary shape (varies by complexity score)
const PRIMARY_SHAPES = {
  low: 'icosahedron',      // complexity 0-33: simple 20-face
  medium: 'octahedron',    // complexity 34-66: 8-face
  high: 'dodecahedron'     // complexity 67-100: 12-face
};

// Wireframe style
const WIREFRAME_CONFIG = {
  lineWidth: 1.5,           // Note: Only works in WebGL2
  opacity: 0.85,
  blending: THREE.AdditiveBlending
};
```

### 5.3 Satellite Geometry

Satellites orbit the primary node to represent individual metrics:

```typescript
interface SatelliteConfig {
  metric: keyof PromptMetrics;
  orbitRadius: number;      // Distance from node center
  orbitSpeed: number;       // Radians per second
  shape: 'sphere' | 'cube' | 'tetrahedron';
  scale: (value: number) => number;  // Maps metric value to satellite size
}

const SATELLITE_CONFIGS: SatelliteConfig[] = [
  {
    metric: 'tokenEstimate',
    orbitRadius: 25,
    orbitSpeed: 0.5,
    shape: 'sphere',
    scale: (v) => Math.min(v / 500, 1) * 8 + 2  // 2-10 size
  },
  {
    metric: 'toolCallCount',
    orbitRadius: 35,
    orbitSpeed: -0.7,  // Opposite direction
    shape: 'cube',
    scale: (v) => v * 3 + 2  // Each tool adds 3 to size
  },
  {
    metric: 'responseLatencyMs',
    orbitRadius: 45,
    orbitSpeed: 0.3,
    shape: 'tetrahedron',
    scale: (v) => Math.min(v / 10000, 1) * 6 + 2  // 2-8 size
  },
  {
    metric: 'topicDriftScore',
    orbitRadius: 55,
    orbitSpeed: -0.4,
    shape: 'sphere',
    scale: (v) => (v ?? 0) * 8 + 2  // 2-10 size, handles null
  }
];
```

### 5.4 Connection Splines

Connections between nodes use bezier curves (matching live-desktop pattern):

```typescript
// From live-desktop: buildSubwayCurve adaptation
function buildNodeConnection(start: Vector3, end: Vector3): THREE.CurvePath<Vector3> {
  const curvePath = new THREE.CurvePath<Vector3>();
  
  const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
  const offset = new THREE.Vector3(
    (Math.random() - 0.5) * 40,
    (Math.random() - 0.5) * 40,
    (Math.random() - 0.5) * 20
  );
  midPoint.add(offset);
  
  curvePath.add(new THREE.QuadraticBezierCurve3(start, midPoint, end));
  return curvePath;
}

// Pulse animation (data packet traveling along spline)
const PULSE_CONFIG = {
  speed: 0.3,           // 0-1 normalized position per second
  size: 3,              // Pulse particle radius
  fadeZone: 0.15        // Fade at endpoints
};
```

---

## 6. UI Component Contract

### 6.1 Module: `src/ui/navigation-controls.ts`

```typescript
/**
 * Navigation arrows + node counter overlay.
 */
export class NavigationControls {
  constructor(options: NavControlsOptions);
  
  mount(container: HTMLElement): void;
  dispose(): void;
  
  // State
  setState(current: number, total: number): void;
  setEnabled(prev: boolean, next: boolean): void;
  
  // Events
  on(event: 'prev' | 'next' | 'jump', handler: (index?: number) => void): void;
  off(event: string, handler: Function): void;
}

interface NavControlsOptions {
  position: 'bottom-center' | 'bottom-left' | 'bottom-right';
  showCounter: boolean;
  showTimeline: boolean;  // Mini timeline with clickable dots
  theme: 'frost' | 'dark';
}
```

### 6.2 Module: `src/ui/details-panel.ts`

```typescript
/**
 * Slide-out panel showing prompt details.
 */
export class DetailsPanel {
  constructor(options: DetailsPanelOptions);
  
  mount(container: HTMLElement): void;
  dispose(): void;
  
  // State
  show(node: PromptNode): void;
  hide(): void;
  isVisible(): boolean;
  
  // Events
  on(event: 'close' | 'navigate', handler: Function): void;
  off(event: string, handler: Function): void;
}

interface DetailsPanelOptions {
  position: 'right' | 'left';
  width: number;          // Pixels, default 360
  showMetrics: boolean;
  showFullText: boolean;
  theme: 'frost' | 'dark';
}
```

### 6.3 Details Panel Content Structure

```html
<aside class="pqv-details-panel frost-glass">
  <header class="pqv-details-header">
    <span class="pqv-details-index">Prompt #5</span>
    <span class="pqv-details-time">2026-02-11 01:05:32</span>
    <button class="pqv-details-close">×</button>
  </header>
  
  <section class="pqv-details-text">
    <h4>Prompt Text</h4>
    <pre class="pqv-prompt-content"><!-- Full prompt text --></pre>
  </section>
  
  <section class="pqv-details-metrics">
    <h4>Metrics</h4>
    <div class="pqv-metric-grid">
      <div class="pqv-metric">
        <span class="pqv-metric-label">Tokens</span>
        <span class="pqv-metric-value">~245</span>
      </div>
      <div class="pqv-metric">
        <span class="pqv-metric-label">Tools</span>
        <span class="pqv-metric-value">3</span>
      </div>
      <div class="pqv-metric">
        <span class="pqv-metric-label">Latency</span>
        <span class="pqv-metric-value">2.4s</span>
      </div>
      <div class="pqv-metric">
        <span class="pqv-metric-label">Complexity</span>
        <span class="pqv-metric-value pqv-complexity-high">78</span>
      </div>
    </div>
  </section>
  
  <section class="pqv-details-tools">
    <h4>Tools Used</h4>
    <ul class="pqv-tool-list">
      <li class="pqv-tool-tag">web_search</li>
      <li class="pqv-tool-tag">read</li>
      <li class="pqv-tool-tag">exec</li>
    </ul>
  </section>
  
  <footer class="pqv-details-nav">
    <button class="pqv-nav-prev">← Prev</button>
    <button class="pqv-nav-next">Next →</button>
  </footer>
</aside>
```

### 6.4 Module: `src/ui/widget-shell.ts`

```typescript
/**
 * Complete standalone widget container.
 * Orchestrates renderer, navigation, and details panel.
 */
export class PromptQuantWidget {
  constructor(options: WidgetOptions);
  
  // Lifecycle
  mount(container: HTMLElement): void;
  dispose(): void;
  
  // Data
  loadSession(jsonlPath: string): Promise<void>;
  loadNodes(nodes: PromptNode[]): void;
  
  // Navigation API
  goToNode(index: number): void;
  goNext(): void;
  goPrev(): void;
  getCurrentNode(): PromptNode | null;
  
  // Events
  on(event: WidgetEvent, handler: Function): void;
}

interface WidgetOptions {
  // Subcomponent options
  renderer: StarmapOptions;
  navigation: NavControlsOptions;
  details: DetailsPanelOptions;
  
  // Widget-level
  autoPlay: boolean;      // Auto-advance through nodes (default: false)
  autoPlayInterval: number; // Ms between nodes if autoPlay
}

type WidgetEvent = 
  | 'ready'
  | 'session:loaded'
  | 'node:change'
  | 'error';
```

---

## 7. File Structure

```
projects/prompt-quant-visualizer/
├── BRIEF.md                          # Project brief
├── package.json                      # Dependencies + scripts
├── tsconfig.json                     # TypeScript config
├── vite.config.ts                    # Vite bundler config
│
├── docs/
│   ├── SPEC.md                       # This file
│   ├── art-direction-codex.md        # Art Director A output
│   ├── art-direction-aurora.md       # Art Director B output
│   ├── metrics-spec.md               # Prompt Analyst output
│   └── README.md                     # Doc Writer output
│
├── public/
│   ├── index.html                    # Standalone entry point
│   ├── styles/
│   │   ├── main.css                  # Base styles
│   │   ├── frost-glass.css           # Frost glass component styles
│   │   └── widget.css                # Widget-specific styles
│   └── assets/
│       └── (icons, textures)
│
├── src/
│   ├── index.ts                      # Main entry, exports all public API
│   │
│   ├── data/
│   │   ├── session-parser.ts         # JSONL → PromptNode[]
│   │   ├── metrics-calculator.ts     # Metric computation
│   │   └── types.ts                  # Shared TypeScript interfaces
│   │
│   ├── viz/
│   │   ├── starmap-renderer.ts       # Main Three.js renderer class
│   │   ├── node-geometry.ts          # Node + satellite mesh creation
│   │   ├── connection-splines.ts     # Bezier path connections
│   │   ├── layout-engine.ts          # Spatial positioning algorithms
│   │   ├── glow-effects.ts           # Post-processing glow
│   │   └── camera-controller.ts      # Orbit + follow camera modes
│   │
│   ├── ui/
│   │   ├── navigation-controls.ts    # Prev/Next arrows
│   │   ├── details-panel.ts          # Prompt details overlay
│   │   ├── widget-shell.ts           # Complete widget orchestrator
│   │   └── timeline-bar.ts           # Optional timeline scrubber
│   │
│   └── integration/
│       ├── live-desktop-embed.ts     # CSS3DObject wrapper for live-desktop
│       └── standalone.ts             # Standalone initialization
│
├── test/
│   ├── fixtures/
│   │   ├── sample-session.jsonl      # Test data
│   │   └── edge-cases.jsonl          # Parser edge cases
│   ├── session-parser.test.ts
│   ├── metrics-calculator.test.ts
│   └── smoke.test.ts                 # Basic rendering smoke test
│
└── scripts/
    └── dev.ts                        # Dev server launcher
```

---

## 8. Integration: Live-Desktop Embedding

### 8.1 Module: `src/integration/live-desktop-embed.ts`

```typescript
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { StarmapRenderer } from '../viz/starmap-renderer';

/**
 * Wraps the starmap in a CSS3DObject for live-desktop embedding.
 * Follows the window creation pattern from live-desktop app.js.
 */
export function createEmbeddedWidget(
  scene: THREE.Scene,
  options: EmbedOptions
): EmbeddedWidget {
  // Create container element (matches live-desktop window structure)
  const glow = document.createElement('div');
  glow.className = 'window-glow';
  
  const win = document.createElement('section');
  win.className = 'window window-prompt-quant';
  
  const inner = document.createElement('div');
  inner.className = 'frame__inner';
  
  const header = document.createElement('div');
  header.className = 'window-header';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'window-title';
  titleEl.textContent = 'PROMPT.QUANT.STARMAP';
  
  const badges = document.createElement('div');
  badges.className = 'window-badges';
  
  header.append(titleEl, badges);
  
  const body = document.createElement('div');
  body.className = 'window-body pqv-embed-body';
  body.style.width = `${options.width}px`;
  body.style.height = `${options.height}px`;
  
  inner.append(header, body);
  win.appendChild(inner);
  glow.appendChild(win);
  
  // Create CSS3DObject
  const css3dObj = new CSS3DObject(glow);
  css3dObj.position.set(options.x ?? -860, options.y ?? 200, options.z ?? 50);
  css3dObj.rotation.set(
    options.rotX ?? -0.002,
    options.rotY ?? 0.003,
    options.rotZ ?? 0.001
  );
  scene.add(css3dObj);
  
  // Mount starmap renderer inside body
  const renderer = new StarmapRenderer({
    ...options.starmapOptions,
    // Force embedded mode settings
    enableGlow: false  // CSS3D doesn't support WebGL post-processing
  });
  renderer.mount(body);
  
  return {
    css3dObject: css3dObj,
    renderer,
    element: glow,
    
    dispose() {
      renderer.dispose();
      scene.remove(css3dObj);
      glow.remove();
    }
  };
}

interface EmbedOptions {
  width: number;              // Default: 700
  height: number;             // Default: 500
  
  // 3D positioning
  x?: number;
  y?: number;
  z?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  
  starmapOptions?: Partial<StarmapOptions>;
}

interface EmbeddedWidget {
  css3dObject: CSS3DObject;
  renderer: StarmapRenderer;
  element: HTMLElement;
  dispose(): void;
}
```

### 8.2 Integration with live-desktop app.js

To add the widget to live-desktop, add to `createDesktopWindows()`:

```typescript
// In live-desktop/public/app.js

import { createEmbeddedWidget, parseSession } from './vendor/prompt-quant-visualizer/index.js';

let pqvWidget = null;

async function createPromptQuantWindow() {
  pqvWidget = createEmbeddedWidget(scene, {
    width: 700,
    height: 500,
    x: -860,
    y: 200,
    z: 50
  });
  
  // Load a session
  const result = await parseSession('/sessions/latest.jsonl');
  if (result.success) {
    pqvWidget.renderer.setNodes(result.nodes);
  }
  
  // Connect to neural network lines (optional)
  windowObjects.set('PROMPT.QUANT.STARMAP', pqvWidget.css3dObject);
}

// Add to createDesktopWindows():
// createPromptQuantWindow();
```

### 8.3 Neural Network Connection

To connect to the existing neural network visualization:

```typescript
// Add to WINDOW_TITLES_TO_CONNECT array
const WINDOW_TITLES_TO_CONNECT = [
  // ... existing windows ...
  'PROMPT.QUANT.STARMAP'
];
```

---

## 9. Dependencies

```json
{
  "dependencies": {
    "three": "^0.162.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/three": "^0.162.0",
    "vitest": "^1.2.0"
  }
}
```

---

## 10. Development Workflow

### 10.1 Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "eslint src/",
    "bundle:embed": "vite build --config vite.embed.config.ts"
  }
}
```

### 10.2 Build Outputs

| Command | Output | Purpose |
|---------|--------|---------|
| `npm run dev` | dev server :5173 | Local development |
| `npm run build` | `dist/` | Standalone deployment |
| `npm run bundle:embed` | `dist/embed/pqv.esm.js` | Single file for live-desktop import |

---

## 11. Implementation Order

1. **Phase 1: Data Layer** (Data Engineer)
   - `src/data/types.ts`
   - `src/data/session-parser.ts`
   - `src/data/metrics-calculator.ts`
   - Unit tests for parser + metrics

2. **Phase 2: Visualization Core** (Viz Engineer)
   - `src/viz/node-geometry.ts`
   - `src/viz/connection-splines.ts`
   - `src/viz/layout-engine.ts`
   - `src/viz/starmap-renderer.ts`

3. **Phase 3: UI Shell** (UI Engineer)
   - `public/styles/*.css`
   - `src/ui/navigation-controls.ts`
   - `src/ui/details-panel.ts`
   - `src/ui/widget-shell.ts`

4. **Phase 4: Integration** (Integrator)
   - `src/integration/standalone.ts`
   - `src/integration/live-desktop-embed.ts`
   - `public/index.html`

5. **Phase 5: Polish** (All)
   - Glow effects
   - Camera animations
   - Semantic similarity (stretch goal)

---

## 12. Success Criteria

| Requirement | Metric | Target |
|-------------|--------|--------|
| Parse valid JSONL | Test coverage | 100% of parser.test.ts passing |
| Render 100 nodes | FPS | ≥30 FPS sustained |
| Navigation | Latency | <100ms focus transition |
| Embedding | Integration | Loads in live-desktop without errors |
| Visual quality | Review | Art director approval |

---

*Specification complete. Agents may begin implementation.*
