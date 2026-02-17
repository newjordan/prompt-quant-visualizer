# Prompt Quant Visualizer

A 3D starmap that visualizes AI chat sessions. Each prompt becomes a glowing wireframe node in 3D space, connected by spline paths that trace the conversation flow. Orbiting satellites show complexity metrics like token count, tool usage, and topic drift.

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. A demo session loads automatically — or click **Load Session** (or `Ctrl+O`) to open your own `.jsonl` file.

## Session Format

Each line is a JSON object. User messages become nodes:

```jsonl
{"role": "user", "content": "Explain recursion", "timestamp": "2026-01-15T10:00:00Z"}
{"role": "assistant", "content": "Recursion is...", "timestamp": "2026-01-15T10:00:05Z"}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Left / Right` | Previous / Next node |
| `Home / End` | Jump to first / last node |
| `Escape` | Close details panel |
| `Ctrl+O` | Open file picker |
| `Space` | Toggle autoplay |

## Project Structure

```
src/
  data/     # JSONL parser, metrics calculator
  viz/      # Three.js starmap renderer, nodes, paths, satellites
  ui/       # Widget shell, navigation controls, details panel
public/     # index.html, styles
```

## License

MIT
