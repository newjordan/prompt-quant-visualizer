# Prompt Quant Visualizer — Master Brief

## Vision
A 3D "traveled starmap" that visualizes conversation flow. Each sent prompt = a node. Focused sessions = tight paths. Scattered sessions = starburst chaos.

## Core Requirements

### Behavior
- Each user prompt = new node on the starmap
- Nodes connected by travel path (thin spline lines)
- Each node has satellite extensions showing complexity indicators
- Navigation arrows to step back/forward through the journey
- Click node = recall prompt details

### Visual Language
- **Glowing wireframe aesthetic** on spheres/primitives
- **Thin splines** for connections
- **Varied primitives** (not just spheres — cubes, octahedrons, etc. can indicate node type)
- **Frost Glass** styling for UI elements
- Dark background, cyan/blue energy glow palette

### Data Source
- Real session transcripts (`.jsonl` files from OpenClaw sessions)
- Parse user messages as prompt nodes
- Calculate metrics per node

### Metrics Per Node (satellites/complexity)
- Token count / prompt length
- Tool calls made (count + types)
- Response latency
- Semantic similarity to previous node (if feasible for MVP)
- Topic drift indicator

### Navigation
- Current node highlighted (brighter glow)
- Prev/Next arrow controls
- Click-to-jump on any node
- Details panel shows: prompt text, timestamp, metrics

### Deliverable
- Standalone widget (runs independently)
- Embeddable component for live-desktop integration
- Dev standalone first, integrate after

## Project Structure
```
projects/prompt-quant-visualizer/
├── BRIEF.md          # This file
├── docs/
│   ├── SPEC.md               # Architect's spec
│   ├── art-direction-codex.md    # Art Director A output
│   ├── art-direction-aurora.md   # Art Director B output
│   ├── metrics-spec.md           # Prompt Analyst output
│   └── README.md                 # Doc Writer output
├── src/
│   ├── data/         # Session parser, metrics extractor
│   ├── viz/          # Three.js starmap renderer
│   └── ui/           # Widget shell, controls, details panel
├── public/           # Static assets, index.html
└── test/             # Test fixtures, smoke tests
```

## Team
| Agent | Model | Role |
|-------|-------|------|
| Architect | Codex 5.3 | PM/Spec |
| Art Director A | Codex 5.3 | Visual guide (competition) |
| Art Director B | Aurora Alpha | Visual guide (competition) |
| Prompt Analyst | Aurora Alpha | Metrics research |
| Data Engineer | Codex 5.3 | Backend |
| Viz Engineer | Codex 5.3 | Three.js |
| UI Engineer | Codex 5.3 | Frontend |
| QA Reviewer | Opus 4.6 | Review gate |
| Wildcard | Opus 4.6 ultrathink | Investigator |
| Doc Writer | Aurora Alpha | Documentation |
| Integrator | Codex 5.3 | Final assembly |

## Reference
- Live-desktop neural network lines: `/home/frosty/.openclaw/workspace/live-desktop/public/app.js`
- Session transcripts: `/home/frosty/.openclaw/sessions/`
- Frost Glass aesthetic: existing live-desktop CSS

---
*Generated 2026-02-11 01:08 CST*
