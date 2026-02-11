/**
 * nodes.js - Node geometry (wireframe primitives, glowing materials)
 * 
 * Creates glowing wireframe nodes based on complexity score.
 * Low complexity: Icosahedron (20 faces)
 * Medium complexity: Octahedron (8 faces)
 * High complexity: Dodecahedron (12 faces)
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
};

/**
 * Determine node shape based on complexity score.
 * @param {number} complexity - 0-100 complexity score
 * @returns {'icosahedron' | 'octahedron' | 'dodecahedron'}
 */
export function getShapeForComplexity(complexity) {
  if (complexity < 34) return 'icosahedron';
  if (complexity < 67) return 'octahedron';
  return 'dodecahedron';
}

/**
 * Create geometry for a given shape type.
 * @param {string} shape - Shape type
 * @param {number} radius - Node radius
 * @returns {THREE.BufferGeometry}
 */
function createShapeGeometry(shape, radius) {
  switch (shape) {
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(radius, 1);
    case 'octahedron':
      return new THREE.OctahedronGeometry(radius);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(radius);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(radius);
    default:
      return new THREE.IcosahedronGeometry(radius, 1);
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
  
  // Determine shape from complexity
  const shape = getShapeForComplexity(complexity);
  group.userData.shape = shape;
  
  // Create solid geometry and convert to wireframe
  const solidGeometry = createShapeGeometry(shape, radius);
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
  NODE_COLORS,
};
