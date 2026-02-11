# Prompt Quant Visualizer — Art Direction Guide
## Codex Edition

> *"A constellation of thought, frozen in glass and light"*

---

## Philosophy

The Prompt Quant Visualizer is a **traveled starmap of conversation**—each prompt a waypoint, each session a journey through conceptual space. The visual language must convey both the crystalline precision of data and the organic flow of thought.

We draw from the **Frost Glass** aesthetic: deep cosmic backgrounds, cyan-tinted translucency, thin glowing wireframes, and the feeling of looking through ice into a neural network. Every element should feel like it exists in a cold, precise, beautiful void—alive with energy but never chaotic.

---

## 1. Node Primitives

### Core Shapes by Node Type

Each node type has a distinct geometric identity. All primitives are rendered as **wireframe meshes** with glowing edges—never solid fills.

| Node Type | Primitive | Segments | Scale | Rationale |
|-----------|-----------|----------|-------|-----------|
| **Standard Prompt** | Icosahedron | 1 detail | 1.0 | 20 faces suggest complexity within simplicity |
| **System Message** | Octahedron | — | 0.85 | 8 faces, authoritative but smaller |
| **Tool-Heavy Prompt** | Dodecahedron | — | 1.15 | 12 pentagonal faces = many facets of action |
| **Long-Form Prompt** | Elongated Icosahedron | stretched Y×1.4 | 1.0 | Vertical stretch signals length |
| **Error/Failed** | Tetrahedron | — | 0.9 | 4 faces = minimal, sharp, warning |
| **Session Start** | Double Icosahedron | nested, counter-rotate | 1.3 | Birth point, special significance |

### Wireframe Specification

```javascript
// Three.js wireframe material
const nodeMaterial = new THREE.LineBasicMaterial({
  color: 0x00FFCC,           // Nominal cyan
  transparent: true,
  opacity: 0.72,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  linewidth: 1              // Note: linewidth only works in some renderers
});

// Create wireframe geometry
const geometry = new THREE.IcosahedronGeometry(1, 1);
const wireframe = new THREE.WireframeGeometry(geometry);
const node = new THREE.LineSegments(wireframe, nodeMaterial);
```

### Wireframe Edge Style

- **Edge thickness**: 1.5px effective (achieved via glow shader or post-processing)
- **Edge opacity**: 0.72 base, 0.92 when active
- **Inner fill**: None (pure wireframe) OR subtle 0.04 opacity solid for depth
- **Vertex points**: Optional glowing dots at vertices (radius 0.03, additive blend)

---

## 2. Satellite Geometry

Satellites are **complexity indicators**—small geometric elements that orbit or attach to nodes, representing metrics like token count, tool calls, and latency.

### Satellite Types

| Metric | Shape | Behavior | Position |
|--------|-------|----------|----------|
| **Token Count** | Ring of dots | Count = log₂(tokens/100), max 8 | Equatorial orbit, slow rotation |
| **Tool Calls** | Small cubes | One per tool type used | Polar orbit, faster rotation |
| **Response Latency** | Arc segment | Arc length ∝ latency | Fixed position, pulsing opacity |
| **Semantic Drift** | Spiral tendril | Length ∝ drift magnitude | Extends toward previous node |
| **Topic Shift** | Color gradient ring | Hue shift indicates change | Inner ring, static |

### Satellite Attachment Geometry

```javascript
// Satellite orbit parameters
const SATELLITE_CONFIG = {
  orbitRadius: 1.6,           // Distance from node center (node radius = 1.0)
  orbitSpeed: 0.0008,         // Radians per frame
  orbitTilt: Math.PI * 0.15,  // 27° tilt from equator
  
  // Token dots
  tokenDotRadius: 0.06,
  tokenDotGap: Math.PI / 4,   // 45° between dots
  
  // Tool cubes  
  toolCubeSize: 0.08,
  toolCubeOrbitSpeed: 0.0014,
  toolCubeOrbitRadius: 1.8,
  
  // Latency arc
  latencyArcInnerRadius: 1.3,
  latencyArcOuterRadius: 1.45,
  latencyArcMaxAngle: Math.PI * 0.75  // 135° max
};
```

### Satellite Materials

```javascript
const satelliteMaterial = new THREE.PointsMaterial({
  color: 0x84FFD1,           // Softer cyan-green
  size: 3,
  transparent: true,
  opacity: 0.65,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true
});
```

---

## 3. Spline/Path Styling

Connections between nodes are rendered as **thin glowing splines**—neural pathways through the starmap.

### Path Geometry

Paths follow **metro-style orthogonal routing** with rounded corners, creating a circuit-board aesthetic that references the live-desktop neural network lines.

```javascript
// Subway-style curve construction
function buildSubwayCurve(start, end) {
  const curvePath = new THREE.CurvePath();
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  
  const bend = Math.min(140, Math.abs(dx) * 0.45, Math.abs(dy) * 0.45);
  
  // Horizontal-first or vertical-first based on distance
  const preferHorizontal = Math.abs(dx) >= Math.abs(dy);
  
  // Add line segments with quadratic bezier corners
  // ... (see live-desktop/public/app.js for full implementation)
  
  return curvePath;
}

const SPLINE_DIVISIONS = 72;  // Segment count for smooth curves
```

### Path Visual Properties

| Property | Nominal | Active | Historical |
|----------|---------|--------|------------|
| **Stroke Width** | 2px | 3px | 1.5px |
| **Opacity** | 0.45 | 0.85 | 0.22 |
| **Color** | `#00FFCC` | `#7DF4FF` | `#4A8090` |
| **Glow Radius** | 4px | 8px | 2px |
| **Glow Opacity** | 0.25 | 0.45 | 0.12 |

### Path Material

```javascript
// Main line
const pathMaterial = new THREE.LineBasicMaterial({
  color: 0x00FFCC,
  transparent: true,
  opacity: 0.45,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

// Glow line (rendered behind, thicker)
const pathGlowMaterial = new THREE.LineBasicMaterial({
  color: 0x00FFCC,
  transparent: true,
  opacity: 0.18,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
```

### Path Animation: Traveling Pulse

A luminous particle travels along each path, indicating the direction of conversation flow.

```javascript
const PULSE_CONFIG = {
  speed: 0.3,                 // Base speed (units per second)
  speedVariance: 0.2,         // Random variance per path
  size: 4,                    // Pulse particle radius
  opacity: 0.9,               // Peak opacity
  fadeZone: 0.15,             // Fade in/out at endpoints (0-1)
  scaleMin: 0.8,
  scaleMax: 1.2
};

// Pulse animation (per frame)
function animatePulse(pulse, time) {
  const t = ((time * 0.001 * pulse.speed + pulse.offset) % 1);
  pulse.curve.getPointAt(t, pulse.position);
  
  // Fade at endpoints
  const fadeZone = 0.15;
  let opacity = 0.9;
  if (t < fadeZone) opacity = (t / fadeZone) * 0.9;
  else if (t > 1 - fadeZone) opacity = ((1 - t) / fadeZone) * 0.9;
  
  pulse.material.opacity = opacity;
  pulse.mesh.scale.setScalar(0.8 + Math.sin(t * Math.PI) * 0.4);
}
```

---

## 4. Color Palette

### Primary Palette

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Nominal Cyan** | `#00FFCC` | 0, 255, 204 | Active elements, primary glow |
| **Frost Blue** | `#7DDFFF` | 125, 223, 255 | Highlights, focused elements |
| **Ice Green** | `#84FFD1` | 132, 255, 209 | Secondary accents, satellites |
| **Deep Void** | `#040911` | 4, 9, 17 | Background base |
| **Glass Dark** | `#0A1424` | 10, 20, 36 | Panel backgrounds |

### State Colors

| State | Primary | Glow | Opacity |
|-------|---------|------|---------|
| **Nominal** | `#00FFCC` | `#00FFCC` | 0.72 |
| **Active/Focused** | `#7DF4FF` | `#7DDFFF` | 0.92 |
| **Historical** | `#4A8090` | `#3A6575` | 0.35 |
| **Warning** | `#FFD085` | `#FFAA00` | 0.78 |
| **Error** | `#FF8080` | `#FF5A5A` | 0.82 |
| **Satellite** | `#84FFD1` | `#96FFC7` | 0.65 |

### CSS Variables (UI Elements)

```css
:root {
  /* Backgrounds */
  --bg-void: #040911;
  --bg-deep: #071326;
  --bg-glass: rgba(10, 20, 36, 0.66);
  --bg-glass-strong: rgba(6, 13, 24, 0.82);
  
  /* Lines & Strokes */
  --line-nominal: rgba(0, 255, 204, 0.45);
  --line-active: rgba(125, 244, 255, 0.85);
  --line-historical: rgba(74, 128, 144, 0.22);
  
  /* Glows */
  --glow-primary: rgba(0, 255, 204, 0.32);
  --glow-secondary: rgba(132, 255, 209, 0.22);
  --glow-active: rgba(125, 223, 255, 0.45);
  
  /* Text */
  --fg-primary: rgba(224, 242, 255, 0.95);
  --fg-muted: rgba(173, 211, 236, 0.74);
  
  /* Status */
  --ok: rgba(150, 255, 199, 0.95);
  --warn: rgba(255, 208, 133, 0.95);
  --fail: rgba(255, 128, 128, 0.96);
  
  /* Grid overlay */
  --grid: rgba(70, 148, 214, 0.18);
}
```

---

## 5. Glow/Bloom Parameters

### Three.js Bloom Pass Configuration

```javascript
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.65,    // Strength: subtle but present
  0.42,    // Radius: medium spread
  0.88     // Threshold: only bright elements bloom
);

// Recommended bloom layers
// Layer 0: Normal geometry (no bloom)
// Layer 1: Glowing elements (bloom applied)
```

### Per-Element Glow Specification

| Element | Glow Intensity | Glow Radius | Falloff | Color Shift |
|---------|----------------|-------------|---------|-------------|
| **Node (nominal)** | 0.5 | 8px | quadratic | none |
| **Node (active)** | 0.85 | 16px | quadratic | +10% brightness |
| **Node (historical)** | 0.2 | 4px | linear | -20% saturation |
| **Path line** | 0.35 | 6px | linear | none |
| **Path pulse** | 0.9 | 12px | exponential | none |
| **Satellite** | 0.45 | 5px | quadratic | none |

### Pulse Timing

```javascript
const PULSE_TIMING = {
  // Node breathing animation
  nodeBreath: {
    duration: 3500,           // ms per cycle
    easing: 'ease-in-out',
    scaleMin: 1.0,
    scaleMax: 1.03,
    glowMin: 0.5,
    glowMax: 0.7
  },
  
  // Active node pulse
  activePulse: {
    duration: 2000,
    easing: 'ease-in-out',
    glowMin: 0.75,
    glowMax: 0.95
  },
  
  // Path traveling pulse
  pathPulse: {
    duration: 2400,           // ms to traverse path
    stagger: 0.3,             // Random offset per path
  },
  
  // Satellite orbit
  satelliteOrbit: {
    duration: 8000,           // ms per revolution
    easing: 'linear'
  }
};
```

### CSS Glow Animation

```css
@keyframes nodeBreath {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(0, 255, 204, 0.5))
            drop-shadow(0 0 20px rgba(0, 255, 204, 0.25));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(0, 255, 204, 0.7))
            drop-shadow(0 0 28px rgba(0, 255, 204, 0.35));
    transform: scale(1.03);
  }
}

.node-nominal {
  animation: nodeBreath 3.5s ease-in-out infinite;
}
```

---

## 6. Camera Behavior

### Default View

```javascript
const CAMERA_CONFIG = {
  // Initial position
  defaultPosition: new THREE.Vector3(0, 0, 980),
  defaultTarget: new THREE.Vector3(0, 0, 0),
  
  // Field of view
  fov: 44,                    // Matches live-desktop
  near: 1,
  far: 4200,
  
  // Orbit constraints
  minDistance: 400,           // Closest zoom
  maxDistance: 2200,          // Furthest zoom
  minPolarAngle: Math.PI * 0.15,   // 27° from top
  maxPolarAngle: Math.PI * 0.85,   // 153° from top
  
  // Damping
  enableDamping: true,
  dampingFactor: 0.08,
  
  // Parallax (mouse movement)
  parallaxStrength: 0.012,
  parallaxDamping: 0.04
};
```

### Zoom Levels

| Level | Distance | Description | Use Case |
|-------|----------|-------------|----------|
| **Overview** | 1800 | See entire session | Session load, orientation |
| **Standard** | 980 | Default working view | Normal navigation |
| **Focused** | 500 | Single node prominent | Node inspection |
| **Detail** | 280 | Node fills viewport | Deep metrics view |

### Orbit Constraints

```javascript
// OrbitControls configuration
controls.enablePan = true;
controls.panSpeed = 0.5;
controls.enableRotate = true;
controls.rotateSpeed = 0.4;
controls.enableZoom = true;
controls.zoomSpeed = 0.8;

// Smooth momentum
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Prevent camera flip
controls.minPolarAngle = Math.PI * 0.15;
controls.maxPolarAngle = Math.PI * 0.85;
```

### Mouse Parallax

Subtle camera movement in response to mouse position creates a sense of depth:

```javascript
function updateParallax(mouseX, mouseY) {
  // Normalize mouse to -1...1
  const nx = (mouseX / window.innerWidth) * 2 - 1;
  const ny = (mouseY / window.innerHeight) * 2 - 1;
  
  // Target offset
  parallaxTargetX = nx * PARALLAX_STRENGTH * 60;
  parallaxTargetY = ny * PARALLAX_STRENGTH * 40;
  
  // Smooth interpolation
  parallaxX += (parallaxTargetX - parallaxX) * PARALLAX_DAMPING;
  parallaxY += (parallaxTargetY - parallaxY) * PARALLAX_DAMPING;
  
  camera.position.x = basePosition.x + parallaxX;
  camera.position.y = basePosition.y + parallaxY;
}
```

---

## 7. Transition Animations

### Node Creation (Birth Animation)

When a new prompt is sent, the node materializes with dramatic effect:

```javascript
const NODE_BIRTH = {
  duration: 800,              // ms
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',  // Smooth overshoot
  
  // Initial state
  initialScale: 0.0,
  initialOpacity: 0.0,
  initialGlow: 2.5,           // Bright flash
  
  // Final state
  finalScale: 1.0,
  finalOpacity: 0.72,
  finalGlow: 0.5,
  
  // Sequence
  phases: [
    { at: 0.0, scale: 0, opacity: 0 },
    { at: 0.15, scale: 0.3, opacity: 0.9, glow: 2.5 },  // Flash in
    { at: 0.5, scale: 1.1, opacity: 0.85 },              // Overshoot
    { at: 1.0, scale: 1.0, opacity: 0.72, glow: 0.5 }   // Settle
  ]
};
```

### Path Creation

Connection paths draw themselves from source to destination:

```javascript
const PATH_CREATION = {
  duration: 600,
  easing: 'ease-out',
  
  // Path draws progressively using dashOffset
  initialDashOffset: 1.0,     // Fully hidden
  finalDashOffset: 0.0,       // Fully visible
  
  // Glow follows the drawing edge
  glowLeadDistance: 0.08      // 8% ahead of visible path
};
```

### Navigation Transition

When jumping to a different node:

```javascript
const NAVIGATION_TRANSITION = {
  duration: 650,
  easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  
  // Camera movement
  cameraPath: 'arc',          // Slight arc, not linear
  cameraArcHeight: 0.15,      // 15% of travel distance
  
  // Node states during transition
  previousNode: {
    fadeOpacity: { from: 0.92, to: 0.35 },
    fadeDuration: 400
  },
  
  nextNode: {
    brightOpacity: { from: 0.72, to: 0.92 },
    brightDuration: 400,
    glowPulse: true
  }
};
```

### Focus Transition

When clicking a node to focus/inspect:

```javascript
const FOCUS_TRANSITION = {
  duration: 500,
  easing: 'ease-in-out',
  
  // Camera zooms to focused distance
  targetDistance: 280,
  
  // Background nodes fade
  backgroundOpacity: 0.15,
  backgroundBlur: true,       // CSS blur on 2D overlay if needed
  
  // Satellites expand outward
  satelliteOrbitMultiplier: 1.6,
  satelliteOrbitDuration: 400
};
```

### CSS Transition Utilities

```css
.node-transitioning {
  transition: 
    opacity 400ms cubic-bezier(0.25, 1, 0.5, 1),
    transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.node-appearing {
  animation: nodeAppear 800ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes nodeAppear {
  0% {
    transform: scale(0);
    opacity: 0;
    filter: drop-shadow(0 0 40px rgba(0, 255, 204, 1));
  }
  15% {
    transform: scale(0.3);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.85;
  }
  100% {
    transform: scale(1);
    opacity: 0.72;
    filter: drop-shadow(0 0 8px rgba(0, 255, 204, 0.5));
  }
}

.node-focused {
  animation: nodeFocusPulse 2s ease-in-out infinite;
}

@keyframes nodeFocusPulse {
  0%, 100% {
    filter: drop-shadow(0 0 16px rgba(125, 244, 255, 0.75));
  }
  50% {
    filter: drop-shadow(0 0 24px rgba(125, 244, 255, 0.95));
  }
}
```

---

## 8. Frost Glass UI Elements

### Panel Styling

UI panels (details panel, navigation controls) use the Frost Glass aesthetic:

```css
.frost-panel {
  /* Shape */
  --frame-radius: 14px;
  --frame-cut-br: 26px;   /* Signature corner cut */
  
  /* Clip path for corner cuts */
  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(100% - var(--frame-cut-br)),
    calc(100% - var(--frame-cut-br)) 100%,
    0 100%
  );
  
  /* Glass background */
  background:
    linear-gradient(165deg, rgba(12, 28, 46, 0.9), rgba(6, 14, 26, 0.92));
  backdrop-filter: blur(10px) saturate(1.05);
  
  /* Border glow */
  border: 1px solid rgba(146, 234, 255, 0.35);
  box-shadow:
    0 0 0 1px rgba(140, 231, 255, 0.1) inset,
    0 20px 48px rgba(0, 0, 0, 0.55),
    0 0 40px rgba(120, 238, 255, 0.08);
  
  /* Scan lines overlay (via ::after) */
}

.frost-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(
      180deg,
      rgba(138, 235, 255, 0.08) 0,
      rgba(138, 235, 255, 0.08) 1px,
      transparent 1px,
      transparent 3px
    );
  mix-blend-mode: screen;
  opacity: 0.32;
}
```

### Details Panel

```css
.details-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: min(380px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  
  /* Frost Glass base */
  @extend .frost-panel;
  
  /* Specific styling */
  padding: 16px;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  
  background: linear-gradient(180deg, rgba(19, 45, 67, 0.9), rgba(9, 22, 38, 0.82));
  border: 1px solid rgba(129, 227, 244, 0.3);
  border-radius: 8px;
  
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(208, 243, 255, 0.95);
}

.details-metric {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 8px;
  
  border: 1px solid rgba(146, 231, 255, 0.18);
  border-radius: 8px;
  background: rgba(4, 14, 26, 0.7);
  
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(173, 211, 236, 0.9);
}

.details-metric-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(6, 14, 24, 0.8);
  border: 1px solid rgba(145, 225, 255, 0.22);
  overflow: hidden;
}

.details-metric-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(0, 255, 204, 0.9), rgba(132, 255, 209, 0.85));
  box-shadow: 0 0 8px rgba(0, 255, 204, 0.4);
}
```

### Navigation Controls

```css
.nav-controls {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  
  @extend .frost-panel;
  border-radius: 999px;
  clip-path: none;  /* Pill shape, no corner cuts */
}

.nav-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  
  background: rgba(8, 20, 35, 0.8);
  border: 1px solid rgba(147, 229, 255, 0.35);
  
  color: rgba(184, 220, 240, 0.94);
  font-size: 18px;
  
  cursor: pointer;
  transition: all 200ms ease;
}

.nav-button:hover {
  background: rgba(15, 35, 55, 0.9);
  border-color: rgba(0, 255, 204, 0.6);
  color: rgba(0, 255, 204, 0.95);
  box-shadow: 0 0 16px rgba(0, 255, 204, 0.3);
}

.nav-button:active {
  transform: scale(0.95);
}

.nav-counter {
  display: flex;
  align-items: center;
  padding: 0 12px;
  
  font-family: var(--mono);
  font-size: 13px;
  letter-spacing: 0.05em;
  color: rgba(208, 243, 255, 0.95);
}
```

---

## 9. Background & Atmosphere

### Cosmic Background

```css
body {
  background:
    /* Radial glows */
    radial-gradient(1100px 640px at 18% -14%, rgba(84, 168, 255, 0.19), transparent 66%),
    radial-gradient(900px 560px at 86% 8%, rgba(130, 255, 206, 0.14), transparent 62%),
    radial-gradient(980px 660px at 40% 116%, rgba(66, 36, 160, 0.16), transparent 68%),
    /* Base gradient */
    linear-gradient(170deg, #040911 0%, #071326 48%, #07111d 100%);
}

/* Grid overlay */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(70, 148, 214, 0.23) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70, 148, 214, 0.23) 1px, transparent 1px);
  background-size: 64px 64px;
  opacity: 0.35;
  mask-image: radial-gradient(circle at 50% 50%, black 20%, transparent 85%);
}

/* Vignette */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
}
```

### Floating Atmosphere Elements

Optional decorative wire spheres that drift in the background:

```css
.wire-sphere {
  position: fixed;
  border-radius: 999px;
  border: 1px solid rgba(129, 223, 255, 0.18);
  box-shadow:
    0 0 26px rgba(109, 228, 255, 0.08),
    0 0 0 1px rgba(129, 223, 255, 0.1) inset;
  background:
    repeating-radial-gradient(
      circle at 50% 50%,
      transparent 0 14px,
      rgba(131, 217, 255, 0.12) 14px 15px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 18px,
      rgba(131, 217, 255, 0.08) 18px 19px
    );
  opacity: 0.18;
  mix-blend-mode: screen;
  animation: atmosphereDrift 60s ease-in-out infinite;
}

@keyframes atmosphereDrift {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(20px, -15px) rotate(3deg); }
  50% { transform: translate(-10px, 10px) rotate(-2deg); }
  75% { transform: translate(15px, 5px) rotate(1deg); }
}
```

---

## 10. Typography

### Font Stack

```css
:root {
  --mono: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, 
          SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", 
          "Courier New", monospace;
  
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
          Oxygen, Ubuntu, Cantarell, sans-serif;
}
```

### Type Scale

| Element | Size | Weight | Tracking | Transform |
|---------|------|--------|----------|-----------|
| **Panel Title** | 13px | 400 | 0.08em | uppercase |
| **Metric Label** | 11px | 400 | 0.04em | uppercase |
| **Metric Value** | 12px | 500 | 0.02em | none |
| **Prompt Text** | 13px | 400 | 0.01em | none |
| **Timestamp** | 10px | 400 | 0.03em | uppercase |
| **Node Counter** | 13px | 500 | 0.05em | none |

---

## Summary: The Codex Vision

This design language creates a **crystalline neural cosmos**—each prompt a frozen moment of thought, connected by glowing neural pathways, orbited by satellites of meaning. The Frost Glass aesthetic grounds the UI in cold precision while the additive-blend glows inject warmth and life.

Key principles:
1. **Wireframe purity** — Forms are suggested, never filled
2. **Additive luminescence** — Light builds on light
3. **Subtle animation** — Breathing, pulsing, drifting—alive but calm
4. **Deep space** — Void is canvas, not absence
5. **Precision** — Every value considered, every transition intentional

*— Art Direction by Codex, 2026-02-11*
