# Prompt Quant Visualizer

> A 3D "traveled starmap" that visualizes AI conversation sessions as an interactive constellation of prompts.

![Screenshot Placeholder](docs/assets/screenshot.png)
*A dark void background with glowing cyan wireframe nodes connected by spline paths. Each node represents a user prompt, with orbiting satellites showing complexity metrics. A frost-glass details panel slides in from the right showing prompt text and metrics.*

---

## ✨ Features

- **3D Starmap Visualization** — Each prompt becomes a glowing wireframe node in 3D space
- **Session Journey Paths** — Bezier spline connections trace your conversation flow
- **Complexity Satellites** — Orbiting indicators show token count, tool usage, latency, and topic drift
- **Node Geometry Variants** — Icosahedrons, octahedrons, and dodecahedrons based on complexity
- **Frost Glass UI** — Elegant translucent panels with the OpenClaw aesthetic
- **Navigation Controls** — Step through prompts with arrows, timeline, or click-to-jump
- **Details Panel** — View full prompt text, timestamp, and all metrics
- **JSONL Parser** — Load OpenClaw session transcripts directly
- **Live-Desktop Integration** — Embed as a CSS3DObject in the live-desktop scene

---

## 🚀 Quick Start

```bash
# Clone and enter the project
cd projects/prompt-quant-visualizer

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📖 Usage

### Standalone Mode

Run the visualizer independently:

1. Start the dev server (`npm run dev`)
2. Load a session file via the "Load Session" button or `Ctrl+O`
3. Navigate using arrows, keyboard, or click on nodes
4. Click any node to see full details

```bash
# Or open with a session URL parameter
http://localhost:5173?session=/path/to/session.jsonl
```

### Live-Desktop Embed

Import and embed in the live-desktop Three.js scene:

```javascript
import { createEmbeddedWidget, parseSession } from './vendor/prompt-quant-visualizer/index.js';

// Create widget as CSS3DObject
const widget = createEmbeddedWidget(scene, {
  width: 700,
  height: 500,
  x: -860, y: 200, z: 50
});

// Load session data
const result = await parseSession('/sessions/latest.jsonl');
widget.renderer.setNodes(result.nodes);

// Add to window tracking for neural network lines
windowObjects.set('PROMPT.QUANT.STARMAP', widget.css3dObject);
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next node |
| `↑` / `↓` | Previous / Next node (alternate) |
| `Home` | Jump to first node |
| `End` | Jump to last node |
| `Escape` | Close details panel |
| `Ctrl+O` | Open file picker |
| `Space` | Toggle autoplay |

---

## ⚙️ Configuration

### Widget Options

```javascript
const widget = new PromptQuantWidget({
  // Header
  showHeader: true,
  title: 'PROMPT.QUANT.STARMAP',
  
  // Autoplay
  autoPlay: false,
  autoPlayInterval: 3000,  // ms
  
  // Navigation
  navigation: {
    position: 'bottom-center',  // 'bottom-left' | 'bottom-right'
    showCounter: true,
    showTimeline: true,
    theme: 'frost'             // 'frost' | 'dark'
  },
  
  // Details panel
  details: {
    position: 'right',         // 'left' | 'right'
    width: 360,
    showMetrics: true,
    showFullText: true
  },
  
  // Renderer
  renderer: {
    layout: 'path',            // 'path' | 'cluster' | 'spiral'
    nodeSpacing: 100,
    pathCurvature: 0.3,
    maxVisibleNodes: 200,
    enableGlow: true
  }
});
```

### Theme Customization

```javascript
renderer: {
  theme: {
    nodeColor: 0x00ffcc,        // Default node color
    nodeColorActive: 0x00ffff,  // Focused node
    nodeColorHover: 0x66ffee,   // Hovered node
    connectionColor: 0x00ffcc,
    connectionOpacity: 0.5,
    backgroundColor: 0x0a0a0f,
    
    // Satellite colors by metric type
    satelliteColors: {
      length: 0x00aaff,   // Token count (blue)
      tools: 0xffaa00,    // Tool usage (orange)
      latency: 0xff5a5a,  // Response time (red)
      drift: 0xaa44ff     // Topic drift (purple)
    }
  }
}
```

---

## 🏗️ Architecture

```
prompt-quant-visualizer/
├── public/
│   ├── index.html          # Standalone entry point
│   └── style.css           # Frost glass styles
├── src/
│   ├── data/
│   │   ├── session-parser.js    # JSONL → PromptNode[]
│   │   └── metrics-calculator.js
│   ├── viz/
│   │   ├── starmap-renderer.js  # Three.js core
│   │   ├── node-geometry.js     # Wireframe nodes + satellites
│   │   ├── connection-splines.js
│   │   └── camera-controller.js
│   ├── ui/
│   │   ├── widget.js            # Main orchestrator
│   │   ├── navigation.js        # Prev/next controls
│   │   └── details-panel.js     # Prompt info panel
│   └── integration/
│       └── live-desktop-embed.js
└── docs/
    ├── SPEC.md             # Technical specification
    └── USAGE.md            # Detailed usage guide
```

### Data Flow

```
JSONL File → Session Parser → PromptNode[] → Layout Engine → Three.js Scene
                    ↓
           Metrics Calculator
                    ↓
            Complexity Score → Node Geometry (shape selection)
                             → Satellites (size/orbit)
```

---

## 📊 Metrics Reference

Each prompt node tracks:

| Metric | Description | Satellite |
|--------|-------------|-----------|
| `tokenEstimate` | Estimated tokens (chars/4) | Blue sphere |
| `toolCallCount` | Tools invoked in response | Orange cube |
| `responseLatencyMs` | Time to first response | Red tetrahedron |
| `topicDriftScore` | Semantic shift from previous | Purple sphere |
| `complexityScore` | Weighted 0-100 composite | Determines node shape |

**Complexity Score Formula:**
- 40% length factor (caps at 2000 chars)
- 35% tool factor (caps at 5 tools)
- 25% latency factor (caps at 30s)

---

## 📝 License

MIT © OpenClaw

---

## 🙏 Credits

- **Three.js** — 3D rendering engine
- **Vite** — Build tooling
- **JetBrains Mono** — Typography
- **Art Direction** — Codex 5.3 & Aurora Alpha

*Built with the OpenClaw multi-agent pipeline.*
