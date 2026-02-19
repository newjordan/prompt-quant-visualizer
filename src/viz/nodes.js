/**
 * nodes.js - Node geometry (fractal wireframe nodes, glowing materials)
 *
 * Creates glowing wireframe nodes using recursive fractal subdivision.
 * Complexity maps continuously to fractal depth:
 *   0-20%  → depth 0  (clean icosahedron, few vertices)
 *   20-50% → depth ~1 (first subdivision, spiky)
 *   50-80% → depth ~2 (dense wireframe, glows hot in bloom)
 *   80-100% → depth 3  (intricate fractal, almost organic)
 * Fractional depths subdivide a percentage of faces for smooth scaling.
 */

import * as THREE from 'three';

// === Color Palette (merged from art direction guides) ===
export const NODE_COLORS = {
  nominal: 0x00FFCC,      // Frost cyan
  active: 0x7DF4FF,       // Bright active cyan
  hover: 0x66FFEE,        // Hover highlight
  historical: 0x4A8090,   // Faded historical
  warning: 0xFFD085,      // Warning amber
  error: 0xFF8080,        // Error red
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
  vertexGlowIntensity: 1.2,

  // Animation
  breathDuration: 3500,
  breathScaleMin: 1.0,
  breathScaleMax: 1.03,

  // Fractal settings
  fractalMaxDepth: 3,
  fractalExtrudeRatio: 0.3, // How far centroids push outward (fraction of radius)
};

// === Fractal Geometry ===

/**
 * Map complexity (0-100) to a continuous fractal depth (0-3).
 * The curve is slightly eased so low-complexity prompts stay clean.
 * @param {number} complexity - 0-100 complexity score
 * @returns {number} Continuous fractal depth (0 to fractalMaxDepth)
 */
export function complexityToFractalDepth(complexity) {
  const t = Math.max(0, Math.min(complexity, 100)) / 100;
  // Ease-in curve: low complexity stays flat, high complexity ramps
  const eased = t * t * (3 - 2 * t); // smoothstep
  return eased * NODE_CONFIG.fractalMaxDepth;
}

/**
 * Determine a shape descriptor from complexity (kept for API compat).
 * @param {number} complexity - 0-100 complexity score
 * @returns {string} Human-readable fractal depth descriptor
 */
export function getShapeForComplexity(complexity) {
  const depth = complexityToFractalDepth(complexity);
  if (depth < 0.5) return 'fractal-d0';
  if (depth < 1.5) return 'fractal-d1';
  if (depth < 2.5) return 'fractal-d2';
  return 'fractal-d3';
}

/**
 * Subdivide a single triangle into 3 child triangles by extruding the centroid.
 * The centroid is pushed outward along its normal (away from origin) by extrudeDistance.
 * @param {number[]} a - Vertex A [x, y, z]
 * @param {number[]} b - Vertex B [x, y, z]
 * @param {number[]} c - Vertex C [x, y, z]
 * @param {number} radius - Target sphere radius (for normalizing extrusion)
 * @returns {Array<[number[], number[], number[]]>} Three child triangles
 */
function subdivideFace(a, b, c, radius) {
  // Centroid of the triangle
  const cx = (a[0] + b[0] + c[0]) / 3;
  const cy = (a[1] + b[1] + c[1]) / 3;
  const cz = (a[2] + b[2] + c[2]) / 3;

  // Push centroid outward along its direction from origin
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const extrudeDist = radius * NODE_CONFIG.fractalExtrudeRatio;
  const nx = cx / len;
  const ny = cy / len;
  const nz = cz / len;

  const peak = [
    cx + nx * extrudeDist,
    cy + ny * extrudeDist,
    cz + nz * extrudeDist,
  ];

  // Three child triangles: each original edge paired with the peak
  return [
    [a, b, peak],
    [b, c, peak],
    [c, a, peak],
  ];
}

/**
 * Compute the area of a triangle (used for sorting faces for partial subdivision).
 * @param {number[]} a
 * @param {number[]} b
 * @param {number[]} c
 * @returns {number}
 */
function triangleArea(a, b, c) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;
  return 0.5 * Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
}

/**
 * Create fractal geometry by recursively subdividing an icosahedron.
 * Supports fractional depth: at non-integer depths, only a fraction of faces
 * get the final subdivision level (largest faces first), creating smooth scaling.
 *
 * @param {number} radius - Outer radius of the base icosahedron
 * @param {number} depth - Continuous fractal depth (0-3). Integer part = full levels,
 *                         fractional part = percentage of faces subdivided at next level.
 * @returns {THREE.BufferGeometry}
 */
function createFractalGeometry(radius, depth) {
  // Start with a base icosahedron — extract its triangle faces
  const base = new THREE.IcosahedronGeometry(radius, 0);
  const posAttr = base.getAttribute('position');

  // Collect faces as arrays of 3 vertices
  let faces = [];
  for (let i = 0; i < posAttr.count; i += 3) {
    faces.push([
      [posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)],
      [posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1)],
      [posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2)],
    ]);
  }
  base.dispose();

  const fullLevels = Math.floor(depth);
  const fractional = depth - fullLevels;

  // Apply full subdivision levels
  for (let level = 0; level < fullLevels; level++) {
    const next = [];
    for (const [a, b, c] of faces) {
      next.push(...subdivideFace(a, b, c, radius));
    }
    faces = next;
  }

  // Apply partial subdivision for the fractional part
  if (fractional > 0.05 && fullLevels < NODE_CONFIG.fractalMaxDepth) {
    // Sort faces by area descending — subdivide largest faces first
    const indexed = faces.map((face, i) => ({
      face,
      area: triangleArea(face[0], face[1], face[2]),
      idx: i,
    }));
    indexed.sort((a, b) => b.area - a.area);

    const subdivCount = Math.round(fractional * faces.length);
    const subdivided = new Set();
    for (let i = 0; i < subdivCount && i < indexed.length; i++) {
      subdivided.add(indexed[i].idx);
    }

    const next = [];
    faces.forEach((face, i) => {
      if (subdivided.has(i)) {
        next.push(...subdivideFace(face[0], face[1], face[2], radius));
      } else {
        next.push(face);
      }
    });
    faces = next;
  }

  // Build BufferGeometry from faces
  const vertices = new Float32Array(faces.length * 9);
  let vi = 0;
  for (const [a, b, c] of faces) {
    vertices[vi++] = a[0]; vertices[vi++] = a[1]; vertices[vi++] = a[2];
    vertices[vi++] = b[0]; vertices[vi++] = b[1]; vertices[vi++] = b[2];
    vertices[vi++] = c[0]; vertices[vi++] = c[1]; vertices[vi++] = c[2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Create wireframe material with glow properties.
 * @param {object} options
 * @param {number} options.color - Hex color
 * @param {number} options.opacity - Material opacity
 * @param {boolean} options.isActive - Whether node is active/focused
 * @returns {THREE.LineBasicMaterial}
 */
export function createWireframeMaterial({ color = NODE_COLORS.nominal, opacity = NODE_CONFIG.wireframeOpacity, isActive = false } = {}) {
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
 * @param {object} options
 * @param {number} options.complexity - 0-100 complexity score
 * @param {number} options.tokenCount - Token count (affects size)
 * @param {boolean} options.isActive - Whether node is currently focused
 * @param {boolean} options.isHistorical - Whether node is in the past
 * @returns {THREE.Group} Node group containing wireframe and glow elements
 */
export function createNode({ complexity = 50, tokenCount = 100, isActive = false, isHistorical = false } = {}) {
  const group = new THREE.Group();
  group.userData.type = 'promptNode';
  group.userData.complexity = complexity;
  group.userData.isActive = isActive;
  group.userData.isHistorical = isHistorical;

  // Calculate radius based on token count
  const normalizedTokens = Math.min(tokenCount / 500, 1);
  const radius = NODE_CONFIG.minRadius + normalizedTokens * (NODE_CONFIG.maxRadius - NODE_CONFIG.minRadius);
  group.userData.radius = radius;

  // Map complexity to continuous fractal depth
  const fractalDepth = complexityToFractalDepth(complexity);
  const shape = getShapeForComplexity(complexity);
  group.userData.shape = shape;
  group.userData.fractalDepth = fractalDepth;

  // Create fractal geometry and convert to wireframe
  const solidGeometry = createFractalGeometry(radius, fractalDepth);
  const wireframeGeometry = new THREE.WireframeGeometry(solidGeometry);
  
  // Determine color based on state
  let color = NODE_COLORS.nominal;
  let opacity = NODE_CONFIG.wireframeOpacity;
  
  if (isActive) {
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
  
  // Inner glow (subtle solid with very low opacity for depth)
  const innerGlowMaterial = new THREE.MeshBasicMaterial({
    color,
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
  
  // Vertex glow points (optional, adds sparkle at vertices)
  const vertices = solidGeometry.getAttribute('position');
  const uniqueVertices = extractUniqueVertices(vertices);
  
  if (uniqueVertices.length > 0) {
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(uniqueVertices, 3));
    
    const pointsMaterial = new THREE.PointsMaterial({
      color,
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
  
  // Store original materials for state transitions
  group.userData.materials = {
    wireframe: wireframeMaterial,
    innerGlow: innerGlowMaterial,
  };
  
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
 * @param {THREE.Group} nodeGroup - The node group
 * @param {object} state
 * @param {boolean} state.isActive
 * @param {boolean} state.isHovered
 * @param {boolean} state.isHistorical
 */
export function updateNodeState(nodeGroup, { isActive = false, isHovered = false, isHistorical = false } = {}) {
  const materials = nodeGroup.userData.materials;
  if (!materials) return;
  
  let targetColor = NODE_COLORS.nominal;
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
  
  // Update all materials
  if (materials.wireframe) {
    materials.wireframe.color.setHex(targetColor);
    materials.wireframe.opacity = targetOpacity;
  }
  
  if (materials.innerGlow) {
    materials.innerGlow.color.setHex(targetColor);
    materials.innerGlow.opacity = isActive ? 0.08 : 0.04;
  }
  
  // Update vertex glow points
  nodeGroup.traverse((child) => {
    if (child.userData.role === 'vertexGlow' && child.material) {
      child.material.color.setHex(targetColor);
      child.material.opacity = isActive ? 0.8 : 0.6;
    }
  });
  
  // Scale effect for hover/active
  const targetScale = isHovered ? 1.05 : (isActive ? 1.0 : 1.0);
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
 * Returns animation state that should be updated each frame.
 * @param {THREE.Group} nodeGroup - The node group
 * @returns {object} Animation controller
 */
export function createNodeBirthAnimation(nodeGroup) {
  const duration = 800;
  const startTime = performance.now();
  
  // Start invisible and small
  nodeGroup.scale.setScalar(0);
  nodeGroup.userData.materials?.wireframe && (nodeGroup.userData.materials.wireframe.opacity = 0);
  
  return {
    isComplete: false,
    update(currentTime) {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Easing: cubic-bezier(0.22, 1, 0.36, 1) approximation
      const eased = 1 - Math.pow(1 - t, 3);
      
      // Scale with overshoot
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
  getShapeForComplexity,
  complexityToFractalDepth,
  NODE_COLORS,
};
