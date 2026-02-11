# Art Direction Guide — Aurora Vision

> *"A conversation is a voyage through possibility space. Each prompt is a star visited, each path a light-year traveled, each satellite a truth learned along the way."*

---

## 1. Node Primitives — The Stellar Taxonomy

### Philosophy
Nodes are not merely markers—they are **celestial bodies** with distinct gravitational character. Shape encodes intent, scale encodes impact.

### Shape Assignments

| Node Type | Primitive | Rationale |
|-----------|-----------|-----------|
| **Question** | Icosahedron (20 faces) | Faceted complexity, seeking illumination |
| **Command/Directive** | Octahedron (8 faces) | Sharp, decisive, action-oriented |
| **Conversational** | Dodecahedron (12 faces) | Organic flow, natural rhythm |
| **Tool Invocation** | Truncated Cube | Technical precision with softened edges |
| **Creative Request** | Stellated Octahedron (Star) | Expansive, generative energy |
| **Error/Retry** | Inverted Tetrahedron | Pointed downward, course correction |

### Wireframe Specification

```javascript
const WIREFRAME_CONFIG = {
  lineWidth: 1.2,                    // Base line thickness (px)
  opacity: 0.85,                     // Nominal state opacity
  dashSize: 0,                       // Solid lines (no dash)
  edgeEmissiveIntensity: 0.4,        // Self-illumination strength
  vertexGlowRadius: 0.08,            // Vertex highlight sphere radius (relative)
  vertexGlowIntensity: 1.2,          // Vertex glow brightness
};
```

### Scale Mapping
Node radius scales with prompt token count:
```javascript
const radius = Math.max(0.15, Math.min(0.6, 0.1 + (tokens / 500) * 0.5));
// Min: 0.15 units (brief prompt)
// Max: 0.6 units (substantial prompt)
```

---

## 2. Satellite Geometry — Complexity Constellations

### Philosophy
Satellites orbit their parent node like moons around a planet—each representing a **measurable truth** about the interaction. Their arrangement creates a unique "fingerprint" for each node.

### Satellite Types & Geometry

| Metric | Shape | Size | Orbit Radius |
|--------|-------|------|--------------|
| **Token Count** | Sphere | 0.02–0.08 | 0.25 |
| **Tool Calls** | Cube (per call) | 0.03 | 0.35 |
| **Response Latency** | Ring/Torus | thickness∝latency | 0.20 |
| **Topic Drift** | Tetrahedron | 0.04 | 0.45 |
| **Semantic Similarity** | Line (to prev node) | n/a | direct connection |

### Orbital Mechanics

```javascript
const SATELLITE_ORBIT = {
  // Satellites distribute evenly on orbital shells
  baseOrbitRadius: 0.25,
  orbitShellSpacing: 0.1,           // Distance between orbital shells
  orbitTilt: Math.PI / 6,           // 30° tilt from node equator
  orbitSpeed: 0.3,                  // Radians per second (subtle)
  orbitEccentricity: 0.15,          // Slight elliptical wobble
  
  // Satellites pulse gently
  pulseCycle: 3000,                 // ms for full pulse
  pulseAmplitude: 0.15,             // ±15% scale variation
};
```

### Tool Call Satellites — Special Treatment
When a prompt triggers tool calls, each tool becomes a small cube satellite:
- **File operations**: Amber cubes (`#F5A623`)
- **Web/API calls**: Cyan cubes (`#00D4FF`)
- **Browser actions**: Magenta cubes (`#FF3366`)
- **System commands**: White cubes (`#E8E8E8`)

Cubes arrange in a **ring formation** at orbit radius 0.35, spinning slowly as a group.

---

## 3. Spline/Path Styling — Warp Signatures

### Philosophy
Paths are **light echoes of the journey**—not rigid connections but flowing energy trails that dim with age, like the cooling wake of a starship.

### Path Geometry

```javascript
const PATH_CONFIG = {
  // Geometry
  curveType: 'CatmullRomCurve3',    // Smooth interpolation
  tension: 0.5,                     // Curve tightness (0=loose, 1=tight)
  segments: 64,                     // Points per path
  
  // Tube rendering
  tubeRadius: 0.008,                // Thin luminous thread
  radialSegments: 8,                // Tube smoothness
  
  // Alternative: Line with custom shader
  lineWidth: 2.0,                   // If using LineBasicMaterial
};
```

### Path Animation — The "Warp Trail" Effect

```javascript
const PATH_ANIMATION = {
  // Energy pulse traveling along path
  pulseSpeed: 0.4,                  // Units per second
  pulseLength: 0.15,               // Length of bright segment (0-1)
  pulseIntensity: 2.5,             // Brightness multiplier at pulse peak
  
  // Path aging (older paths fade)
  maxAge: 20,                       // Paths older than N steps fade
  ageFadeStart: 5,                  // Begin fading after N steps
  minOpacity: 0.15,                // Never fully invisible
  
  // Flow direction indicators (subtle arrows)
  flowMarkers: true,
  flowMarkerSpacing: 0.3,          // Markers every 0.3 units
  flowMarkerSize: 0.02,
};
```

### Path Shader Pseudocode
```glsl
// Vertex color varies along length for "energy flow" effect
float flow = fract(vProgress - uTime * pulseSpeed);
float pulse = smoothstep(0.0, pulseLength, flow) * smoothstep(pulseLength * 2.0, pulseLength, flow);
vec3 color = mix(baseColor, glowColor, pulse * pulseIntensity);
```

---

## 4. Color Palette — The Celestial Spectrum

### Philosophy
Color is **information and emotion**. The palette evokes deep space with bioluminescent life—cold vastness punctuated by warm intention.

### Primary Palette

| Role | Name | Hex | RGB | Usage |
|------|------|-----|-----|-------|
| **Nominal Node** | Frost Blue | `#4A9EFF` | 74, 158, 255 | Default node wireframe |
| **Active Node** | Plasma White | `#FFFFFF` | 255, 255, 255 | Currently focused node core |
| **Active Glow** | Nova Cyan | `#00F5FF` | 0, 245, 255 | Active node bloom |
| **Historical (Recent)** | Nebula Teal | `#2DD4BF` | 45, 212, 191 | Nodes 1-5 steps back |
| **Historical (Distant)** | Void Indigo | `#6366F1` | 99, 102, 241 | Nodes 6+ steps back |
| **Path Active** | Stream Cyan | `#22D3EE` | 34, 211, 238 | Current path glow |
| **Path Historical** | Echo Blue | `#3B82F6` | 59, 130, 246 | Older path segments |
| **Path Ancient** | Ghost Slate | `#475569` | 71, 85, 105 | Very old paths |

### Satellite Palette

| Metric | Color | Hex |
|--------|-------|-----|
| Token Count | Solar Gold | `#FBBF24` |
| Tool Calls | Circuit Green | `#10B981` |
| Response Latency | Pulse Pink | `#EC4899` |
| Topic Drift | Drift Violet | `#8B5CF6` |
| Similarity High | Harmony Teal | `#14B8A6` |
| Similarity Low | Dissonance Red | `#EF4444` |

### Background Gradient
```css
/* Deep space gradient */
background: radial-gradient(
  ellipse at 30% 20%,
  #0a1628 0%,      /* Midnight blue core */
  #050d1a 40%,     /* Deep void */
  #020409 100%     /* True black edge */
);
```

### Color Application Rules
1. **Never pure black** for nodes—minimum luminosity `#1a1a2e`
2. **Active state always white core** with colored bloom
3. **Saturation decreases with age** (distant history = desaturated)
4. **Satellites always saturated** (they represent fresh data)

---

## 5. Glow & Bloom — The Luminous Atmosphere

### Philosophy
Bloom is the **breath of the visualization**—it makes wireframes feel alive, not clinical. Every light source should bleed slightly into darkness.

### UnrealBloomPass Configuration

```javascript
const BLOOM_CONFIG = {
  // Global bloom
  threshold: 0.6,                   // Only bright areas bloom
  strength: 1.8,                    // Overall bloom intensity
  radius: 0.4,                      // Bloom spread (0-1)
  
  // Selective bloom layers
  layers: {
    nodes: 1,                       // Bloom layer for nodes
    paths: 2,                       // Bloom layer for paths
    satellites: 1,                  // Same as nodes
    ui: 0,                          // No bloom on UI
  },
};
```

### Per-Element Glow Intensity

| Element | Emissive Intensity | Notes |
|---------|-------------------|-------|
| Nominal Node | 0.4 | Subtle presence |
| Active Node | 2.5 | Commanding attention |
| Historical Node (recent) | 0.6 | Slightly brighter than nominal |
| Historical Node (distant) | 0.2 | Fading into the void |
| Path (active segment) | 1.2 | Clear current trajectory |
| Path (historical) | 0.3 | Visible but receding |
| Satellites | 0.8 | Always readable |

### Pulse Animations

```javascript
const PULSE_CONFIG = {
  // Active node "heartbeat"
  active: {
    frequency: 1.2,                 // Hz (pulses per second)
    waveform: 'sine',               // smooth oscillation
    minIntensity: 2.0,
    maxIntensity: 3.5,
  },
  
  // Satellite orbit pulse (slower, meditative)
  satellite: {
    frequency: 0.33,                // ~3 second cycle
    waveform: 'sine',
    minScale: 0.85,
    maxScale: 1.15,
  },
  
  // Path "energy flow" pulse
  path: {
    speed: 0.4,                     // Units per second along path
    width: 0.15,                    // Pulse width as fraction of path
    intensity: 2.5,                 // Peak brightness
  },
};
```

### Glow Falloff Curve
```javascript
// Emissive falloff based on distance from active node
function getNodeGlow(stepsFromActive) {
  if (stepsFromActive === 0) return 2.5;  // Active
  if (stepsFromActive <= 3) return 0.6 - (stepsFromActive * 0.1);  // Recent
  if (stepsFromActive <= 10) return 0.3 - ((stepsFromActive - 3) * 0.02);  // Mid
  return 0.15;  // Distant (minimum visibility)
}
```

---

## 6. Camera Behavior — The Navigator's Eye

### Philosophy
The camera is the **user's vessel**—it should feel responsive yet smooth, like piloting through familiar space. Auto-framing keeps context; user control maintains agency.

### Default View

```javascript
const CAMERA_DEFAULTS = {
  // Initial position
  position: { x: 0, y: 2, z: 8 },   // Elevated, looking slightly down
  target: { x: 0, y: 0, z: 0 },     // Scene center
  fov: 50,                          // Moderate field of view
  near: 0.1,
  far: 1000,
  
  // Auto-frame padding
  framePadding: 1.5,                // Extra space around content (multiplier)
};
```

### Orbit Controls

```javascript
const ORBIT_CONFIG = {
  // Rotation
  enableRotate: true,
  rotateSpeed: 0.8,
  autoRotate: true,                 // Gentle ambient rotation when idle
  autoRotateSpeed: 0.15,            // Very slow (degrees/sec)
  
  // Zoom
  enableZoom: true,
  zoomSpeed: 1.2,
  minDistance: 2,                   // Can't get too close
  maxDistance: 50,                  // Can't get too far
  
  // Pan
  enablePan: true,
  panSpeed: 0.8,
  screenSpacePanning: true,
  
  // Damping (smooth stops)
  enableDamping: true,
  dampingFactor: 0.08,              // Smooth deceleration
  
  // Constraints
  minPolarAngle: Math.PI * 0.1,     // 18° (can't go directly below)
  maxPolarAngle: Math.PI * 0.85,    // 153° (can't go directly above)
};
```

### Zoom Levels — Semantic Distances

| Level | Distance | Use Case |
|-------|----------|----------|
| **Overview** | 15–50 | See entire journey at once |
| **Context** | 5–15 | See current region + neighbors |
| **Focus** | 2–5 | Examine single node + satellites |

### Camera Transitions

```javascript
const CAMERA_TRANSITIONS = {
  // When navigating to new node
  focusDuration: 800,               // ms to reach new position
  focusEasing: 'easeInOutCubic',
  
  // When clicking distant node
  jumpDuration: 1200,               // Longer for bigger jumps
  jumpEasing: 'easeInOutQuart',
  
  // Idle drift (very subtle)
  idleDriftRadius: 0.3,             // Slight position variation
  idleDriftSpeed: 0.05,             // Very slow
};
```

### Focus Behavior
When focusing on a node:
1. Camera smoothly orbits to face the node
2. Distance adjusts to "Focus" level (~3 units from node surface)
3. Camera slightly elevates to show satellites above node
4. Auto-rotate pauses during manual interaction

---

## 7. Transition Animations — The Dance of Change

### Philosophy
Transitions should feel **inevitable yet delightful**—like celestial mechanics, not UI chrome. Every change has weight and purpose.

### Node Creation — "Stellar Ignition"

```javascript
const NODE_CREATION = {
  // Phase 1: Emergence (node appears)
  emerge: {
    duration: 400,
    startScale: 0,
    endScale: 1.2,                  // Slight overshoot
    startOpacity: 0,
    endOpacity: 1,
    easing: 'easeOutBack',          // Bouncy arrival
  },
  
  // Phase 2: Settle (node settles to final size)
  settle: {
    duration: 200,
    startScale: 1.2,
    endScale: 1.0,
    easing: 'easeOutQuad',
  },
  
  // Phase 3: Path draws in
  pathDraw: {
    duration: 600,
    easing: 'easeInOutQuad',
    // Path "grows" from previous node to new node
  },
  
  // Phase 4: Satellites deploy
  satelliteDeploy: {
    delay: 300,                     // After node settles
    duration: 500,
    startRadius: 0,
    endRadius: 1,                   // Full orbit radius
    staggerDelay: 80,               // Each satellite delays slightly
    easing: 'easeOutCubic',
  },
};
```

### Navigation — "Warp Transit"

```javascript
const NAVIGATION = {
  // Old active node dims
  deactivate: {
    duration: 300,
    endIntensity: 0.6,              // Returns to "recent" glow
    easing: 'easeOutQuad',
  },
  
  // New active node ignites
  activate: {
    duration: 400,
    startIntensity: 0.6,
    endIntensity: 2.5,
    pulseOnArrival: true,           // Extra bright flash
    easing: 'easeOutQuad',
  },
  
  // Path highlight shifts
  pathShift: {
    duration: 500,
    // Energy "flows" along path toward new active node
  },
  
  // Camera follows (see CAMERA_TRANSITIONS)
};
```

### Focus/Selection — "Gravitational Lock"

```javascript
const FOCUS_TRANSITION = {
  // Node acknowledges selection
  select: {
    duration: 150,
    scaleMultiplier: 1.1,           // Brief size pop
    easing: 'easeOutQuad',
  },
  
  // Details panel slides in
  panelReveal: {
    duration: 300,
    direction: 'right',             // Slides from right edge
    easing: 'easeOutCubic',
  },
  
  // Satellites "present" (face camera)
  satellitePresent: {
    duration: 400,
    // Satellites spread out for better visibility
    spreadMultiplier: 1.3,
  },
};
```

### Hover States

```javascript
const HOVER = {
  // Node hover (cursor over node)
  node: {
    scaleMultiplier: 1.05,
    glowBoost: 0.3,                 // Adds to current glow
    transitionDuration: 150,
  },
  
  // Satellite hover
  satellite: {
    scaleMultiplier: 1.2,
    showLabel: true,                // Metric name appears
    transitionDuration: 100,
  },
  
  // Path hover
  path: {
    thicknessMultiplier: 1.5,
    glowBoost: 0.5,
    transitionDuration: 100,
  },
};
```

---

## 8. Spatial Layout — Constellation Topology

### Philosophy
The starmap should **emerge from the data**—focused sessions cluster, scattered sessions spread. Time flows forward; topic shifts sideways.

### Layout Algorithm

```javascript
const LAYOUT_CONFIG = {
  // Base spacing
  nodeSpacing: 1.5,                 // Default distance between sequential nodes
  
  // Semantic clustering
  similarityAttraction: 0.8,        // High similarity = nodes pull closer
  driftRepulsion: 0.6,              // Topic drift = nodes push apart
  
  // Time axis (forward = +Z by default)
  timeAxisWeight: 0.7,              // How strongly time orders nodes
  
  // 3D distribution
  verticalVariance: 0.4,            // Random Y offset (adds depth)
  lateralVariance: 0.3,             // Random X offset
  
  // Prevent overlap
  minNodeDistance: 0.8,             // Nodes can't get closer than this
};
```

### Visual Density Guidelines
- **Tight cluster**: 5+ nodes within 3-unit radius = focused session
- **Linear path**: Nodes roughly aligned = methodical progression  
- **Starburst**: Nodes radiate outward = exploratory/scattered session

---

## 9. Special Effects — Atmospheric Details

### Background Stars (Subtle)

```javascript
const STARFIELD = {
  count: 500,
  spread: 100,                      // Radius of starfield sphere
  sizeRange: [0.005, 0.02],
  opacity: 0.3,                     // Very subtle
  twinkle: {
    enabled: true,
    frequency: 0.5,                 // Hz (slow twinkle)
    variance: 0.3,                  // ±30% brightness
  },
};
```

### Depth Fog

```javascript
const FOG = {
  color: '#050d1a',                 // Matches background
  near: 20,                         // Start fading
  far: 60,                          // Fully faded
};
```

### Grid Plane (Optional, Toggle-able)

```javascript
const GRID = {
  enabled: false,                   // Off by default
  size: 50,
  divisions: 50,
  color1: '#1a1a2e',
  color2: '#0a0a1a',
  opacity: 0.2,
};
```

---

## 10. Implementation Notes

### Three.js Material Stack

```javascript
// Node wireframe material
const nodeMaterial = new THREE.MeshBasicMaterial({
  color: PALETTE.nominal,
  wireframe: true,
  transparent: true,
  opacity: WIREFRAME_CONFIG.opacity,
});

// Node glow (separate mesh, slightly larger)
const glowMaterial = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Color(PALETTE.activeGlow) },
    intensity: { value: 2.5 },
    viewVector: { value: camera.position },
  },
  vertexShader: glowVertexShader,
  fragmentShader: glowFragmentShader,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
});
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 fps (40+ acceptable) |
| Max nodes before LOD | 100 |
| Max simultaneous satellites | 500 |
| Bloom quality | Medium (can reduce on mobile) |

### LOD Strategy
- **< 50 nodes**: Full detail
- **50-100 nodes**: Reduce satellite count, simplify distant nodes
- **> 100 nodes**: Cluster distant nodes, reduce path segments

---

## Appendix: Quick Reference Card

```
╔══════════════════════════════════════════════════════════════╗
║                    AURORA PALETTE QUICK REF                  ║
╠══════════════════════════════════════════════════════════════╣
║  NODES                          PATHS                        ║
║  ├─ Nominal:   #4A9EFF         ├─ Active:    #22D3EE        ║
║  ├─ Active:    #FFFFFF         ├─ Historical:#3B82F6        ║
║  ├─ Recent:    #2DD4BF         └─ Ancient:   #475569        ║
║  └─ Distant:   #6366F1                                       ║
║                                                              ║
║  SATELLITES                     GLOW                         ║
║  ├─ Tokens:    #FBBF24         ├─ Active:    2.5 intensity  ║
║  ├─ Tools:     #10B981         ├─ Recent:    0.6 intensity  ║
║  ├─ Latency:   #EC4899         └─ Distant:   0.2 intensity  ║
║  └─ Drift:     #8B5CF6                                       ║
║                                                              ║
║  TIMING                         CAMERA                       ║
║  ├─ Node create: 400ms         ├─ Focus:     3 units        ║
║  ├─ Path draw:   600ms         ├─ Context:   8 units        ║
║  └─ Focus trans: 800ms         └─ Overview:  20 units       ║
╚══════════════════════════════════════════════════════════════╝
```

---

*Aurora Art Direction v1.0 — 2026-02-11*
*"Every prompt is a star. Every session is a constellation. Every conversation is a voyage home."*
