/**
 * nodes.js - Node geometry (word-count-driven subdivision, intent-colored wireframes)
 *
 * Each node is a visual fingerprint of its prompt:
 * - SHAPE comes from word count: few words → sharp tetrahedron,
 *   many words → dense subdivided sphere. The geometry literally
 *   grows with the content.
 * - COLOR comes from intent: question (blue), command (green),
 *   clarification (purple), creative (amber), error (red).
 * - SIZE comes from token count (unchanged from before).
 *
 * The result: you look at a node and immediately know
 * "short command" vs "long question with context" vs "error report".
 */

import * as THREE from 'three';

// === Intent → Color mapping ===
// Matches INTENT_TYPES in metrics.js
export const INTENT_COLORS = {
  question:      0x7DDFFF,  // Soft blue — seeking
  command:       0x00FFCC,  // Cyan-green — directive
  clarification: 0xAA44FF,  // Purple — refining
  creative:      0xFFD085,  // Amber — exploratory
  error:         0xFF5A5A,  // Red — something broke
  informational: 0x84FFD1,  // Soft green — sharing context
};

// === State overrides (applied on top of intent color) ===
export const NODE_COLORS = {
  nominal:    null,         // Use intent color
  active:     0x7DF4FF,     // Bright active cyan (override)
  hover:      0x66FFEE,     // Hover highlight (override)
  historical: 0x4A8090,     // Faded historical (override)
  warning:    0xFFD085,     // Warning amber
  error:      0xFF8080,     // Error red
};

// === Node Configuration ===
const NODE_CONFIG = {
  // Base scale factors
  baseRadius: 15,
  minRadius: 10,
  maxRadius: 25,

  // Wireframe material settings
  wireframeOpacity: 0.72,
  wireframeOpacityActive: 0.92,
  wireframeOpacityHistorical: 0.35,

  // Vertex glow settings
  vertexGlowRadius: 0.08,

  // Animation
  breathDuration: 3500,
  breathScaleMin: 1.0,
  breathScaleMax: 1.03,
};

// === Word count → geometry subdivision ===
// Each tier adds geometric complexity. The visual progression:
// sharp crystal → faceted gem → smooth orb
const WORD_TIERS = [
  { maxWords: 10,   base: 'tetrahedron', detail: 0, label: 'terse'     },
  { maxWords: 25,   base: 'octahedron',  detail: 0, label: 'brief'     },
  { maxWords: 60,   base: 'icosahedron', detail: 0, label: 'moderate'  },
  { maxWords: 150,  base: 'icosahedron', detail: 1, label: 'detailed'  },
  { maxWords: 400,  base: 'icosahedron', detail: 2, label: 'extensive' },
  { maxWords: Infinity, base: 'icosahedron', detail: 3, label: 'dense' },
];

/**
 * Determine geometry parameters from word count.
 * @param {number} wordCount
 * @returns {{ base: string, detail: number, label: string }}
 */
export function getGeometryForWordCount(wordCount) {
  for (const tier of WORD_TIERS) {
    if (wordCount <= tier.maxWords) {
      return { base: tier.base, detail: tier.detail, label: tier.label };
    }
  }
  return WORD_TIERS[WORD_TIERS.length - 1];
}

/**
 * Get the intent color for a prompt.
 * @param {string} intent - Intent key from metrics
 * @returns {number} Hex color
 */
export function getIntentColor(intent) {
  return INTENT_COLORS[intent] || INTENT_COLORS.command;
}

/**
 * Create geometry for a given base shape and detail level.
 * @param {string} base - Base shape type
 * @param {number} detail - Subdivision level
 * @param {number} radius - Node radius
 * @returns {THREE.BufferGeometry}
 */
function createShapeGeometry(base, detail, radius) {
  switch (base) {
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(radius, detail);
    case 'octahedron':
      return new THREE.OctahedronGeometry(radius, detail);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(radius, detail);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(radius, detail);
    default:
      return new THREE.IcosahedronGeometry(radius, detail);
  }
}

/**
 * Create wireframe material with glow properties.
 * @param {object} options
 * @param {number} options.color - Hex color
 * @param {number} options.opacity - Material opacity
 * @param {boolean} options.isActive - Whether node is active/focused
 * @returns {THREE.LineBasicMaterial}
 */
export function createWireframeMaterial({ color = INTENT_COLORS.command, opacity = NODE_CONFIG.wireframeOpacity, isActive = false } = {}) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: isActive ? NODE_CONFIG.wireframeOpacityActive : opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Create a glowing wireframe node.
 *
 * @param {object} options
 * @param {number} options.complexity - 0-100 complexity score (legacy, still used for fallback)
 * @param {number} options.tokenCount - Token count (affects size)
 * @param {number} options.wordCount - Word count (drives geometry subdivision)
 * @param {string} options.intent - Intent classification (drives color)
 * @param {boolean} options.isActive - Whether node is currently focused
 * @param {boolean} options.isHistorical - Whether node is in the past
 * @returns {THREE.Group} Node group containing wireframe and glow elements
 */
export function createNode({
  complexity = 50,
  tokenCount = 100,
  wordCount = 30,
  intent = 'command',
  isActive = false,
  isHistorical = false,
} = {}) {
  const group = new THREE.Group();
  group.userData.type = 'promptNode';
  group.userData.complexity = complexity;
  group.userData.wordCount = wordCount;
  group.userData.intent = intent;
  group.userData.isActive = isActive;
  group.userData.isHistorical = isHistorical;

  // Calculate radius based on token count
  const normalizedTokens = Math.min(tokenCount / 500, 1);
  const radius = NODE_CONFIG.minRadius + normalizedTokens * (NODE_CONFIG.maxRadius - NODE_CONFIG.minRadius);
  group.userData.radius = radius;

  // Determine geometry from word count
  const { base, detail, label } = getGeometryForWordCount(wordCount);
  group.userData.shape = base;
  group.userData.geometryDetail = detail;
  group.userData.geometryLabel = label;

  // Create solid geometry and convert to wireframe
  const solidGeometry = createShapeGeometry(base, detail, radius);
  const wireframeGeometry = new THREE.WireframeGeometry(solidGeometry);

  // Determine color from intent (state overrides applied later)
  const intentColor = getIntentColor(intent);

  let color = intentColor;
  let opacity = NODE_CONFIG.wireframeOpacity;

  if (isActive) {
    // Active nodes get the bright override but blended with intent
    color = NODE_COLORS.active;
    opacity = NODE_CONFIG.wireframeOpacityActive;
  } else if (isHistorical) {
    color = NODE_COLORS.historical;
    opacity = NODE_CONFIG.wireframeOpacityHistorical;
  }

  // Main wireframe mesh
  const wireframeMaterial = createWireframeMaterial({ color, opacity, isActive });
  const wireframeMesh = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
  wireframeMesh.userData.role = 'wireframe';
  group.add(wireframeMesh);

  // Inner glow (use intent color always for the ambient glow)
  const innerGlowMaterial = new THREE.MeshBasicMaterial({
    color: intentColor,
    transparent: true,
    opacity: 0.04,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerGlowMesh = new THREE.Mesh(solidGeometry.clone(), innerGlowMaterial);
  innerGlowMesh.scale.setScalar(0.98);
  innerGlowMesh.userData.role = 'innerGlow';
  group.add(innerGlowMesh);

  // Vertex glow points
  const vertices = solidGeometry.getAttribute('position');
  const uniqueVertices = extractUniqueVertices(vertices);

  if (uniqueVertices.length > 0) {
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(uniqueVertices, 3));

    const pointsMaterial = new THREE.PointsMaterial({
      color: intentColor,
      size: radius * NODE_CONFIG.vertexGlowRadius * 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const vertexPoints = new THREE.Points(pointsGeometry, pointsMaterial);
    vertexPoints.userData.role = 'vertexGlow';
    group.add(vertexPoints);
  }

  // Store original materials and intent color for state transitions
  group.userData.materials = {
    wireframe: wireframeMaterial,
    innerGlow: innerGlowMaterial,
  };
  group.userData.intentColor = intentColor;

  // Dispose the solid geometry since we only need the wireframe
  solidGeometry.dispose();

  return group;
}

/**
 * Extract unique vertices from a BufferAttribute (removes duplicates).
 * @param {THREE.BufferAttribute} positionAttribute
 * @returns {number[]} Flat array of unique vertex positions
 */
function extractUniqueVertices(positionAttribute) {
  const seen = new Set();
  const unique = [];

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(x, y, z);
    }
  }

  return unique;
}

/**
 * Update node visual state (active, hover, historical).
 * Active/hover use bright overrides. Nominal state returns to intent color.
 *
 * @param {THREE.Group} nodeGroup - The node group
 * @param {object} state
 * @param {boolean} state.isActive
 * @param {boolean} state.isHovered
 * @param {boolean} state.isHistorical
 */
export function updateNodeState(nodeGroup, { isActive = false, isHovered = false, isHistorical = false } = {}) {
  const materials = nodeGroup.userData.materials;
  if (!materials) return;

  const intentColor = nodeGroup.userData.intentColor || INTENT_COLORS.command;

  let targetColor = intentColor;  // Default: show intent color
  let targetOpacity = NODE_CONFIG.wireframeOpacity;

  if (isActive) {
    targetColor = NODE_COLORS.active;
    targetOpacity = NODE_CONFIG.wireframeOpacityActive;
  } else if (isHovered) {
    targetColor = NODE_COLORS.hover;
    targetOpacity = 0.85;
  } else if (isHistorical) {
    targetColor = NODE_COLORS.historical;
    targetOpacity = NODE_CONFIG.wireframeOpacityHistorical;
  }

  // Update wireframe
  if (materials.wireframe) {
    materials.wireframe.color.setHex(targetColor);
    materials.wireframe.opacity = targetOpacity;
  }

  // Inner glow stays intent-colored but adjusts opacity
  if (materials.innerGlow) {
    materials.innerGlow.color.setHex(intentColor);
    materials.innerGlow.opacity = isActive ? 0.08 : 0.04;
  }

  // Update vertex glow points
  nodeGroup.traverse((child) => {
    if (child.userData.role === 'vertexGlow' && child.material) {
      child.material.color.setHex(isActive ? targetColor : intentColor);
      child.material.opacity = isActive ? 0.8 : 0.6;
    }
  });

  // Scale effect for hover
  const targetScale = isHovered ? 1.05 : 1.0;
  nodeGroup.scale.setScalar(targetScale);

  nodeGroup.userData.isActive = isActive;
  nodeGroup.userData.isHovered = isHovered;
  nodeGroup.userData.isHistorical = isHistorical;
}

/**
 * Animate node breathing effect.
 * @param {THREE.Group} nodeGroup - The node group
 * @param {number} time - Current time in ms
 */
export function animateNodeBreath(nodeGroup, time) {
  if (!nodeGroup.userData.isActive) return;

  const phase = (time % NODE_CONFIG.breathDuration) / NODE_CONFIG.breathDuration;
  const breath = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
  const scale = NODE_CONFIG.breathScaleMin + breath * (NODE_CONFIG.breathScaleMax - NODE_CONFIG.breathScaleMin);

  nodeGroup.scale.setScalar(scale);

  // Also pulse the glow opacity
  const materials = nodeGroup.userData.materials;
  if (materials?.wireframe) {
    const baseOpacity = NODE_CONFIG.wireframeOpacityActive;
    materials.wireframe.opacity = baseOpacity + breath * 0.08;
  }
}

/**
 * Create a "birth" animation for a new node.
 * @param {THREE.Group} nodeGroup - The node group
 * @returns {object} Animation controller
 */
export function createNodeBirthAnimation(nodeGroup) {
  const duration = 800;
  const startTime = performance.now();

  // Start invisible and small
  nodeGroup.scale.setScalar(0);
  if (nodeGroup.userData.materials?.wireframe) {
    nodeGroup.userData.materials.wireframe.opacity = 0;
  }

  return {
    isComplete: false,
    update(currentTime) {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Easing with overshoot
      const eased = 1 - Math.pow(1 - t, 3);
      let scale;
      if (t < 0.5) {
        scale = eased * 1.2;
      } else {
        const settleT = (t - 0.5) / 0.5;
        scale = 1.2 - settleT * 0.2;
      }
      nodeGroup.scale.setScalar(scale);

      // Opacity fade in
      const opacity = Math.min(t / 0.3, 1) * NODE_CONFIG.wireframeOpacity;
      if (nodeGroup.userData.materials?.wireframe) {
        nodeGroup.userData.materials.wireframe.opacity = opacity;
      }

      if (t >= 1) {
        this.isComplete = true;
        nodeGroup.scale.setScalar(1);
      }
    }
  };
}

/**
 * Dispose of a node and free its resources.
 * @param {THREE.Group} nodeGroup - The node group
 */
export function disposeNode(nodeGroup) {
  nodeGroup.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });

  nodeGroup.clear();
}

export default {
  createNode,
  updateNodeState,
  animateNodeBreath,
  createNodeBirthAnimation,
  disposeNode,
  getGeometryForWordCount,
  getIntentColor,
  INTENT_COLORS,
  NODE_COLORS,
};
