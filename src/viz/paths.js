/**
 * paths.js - Spline connections between nodes (thin glowing lines)
 * 
 * Implements metro-style orthogonal routing with rounded corners,
 * matching the live-desktop neural network line pattern.
 */

import * as THREE from 'three';

// === Path Color Palette ===
export const PATH_COLORS = {
  active: 0x22D3EE,       // Stream cyan - active path
  nominal: 0x00FFCC,      // Frost cyan - recent paths
  historical: 0x3B82F6,   // Echo blue - older paths
  ancient: 0x475569,      // Ghost slate - very old paths
};

// === Path Configuration ===
const PATH_CONFIG = {
  // Geometry
  divisions: 72,          // Segment count for smooth curves
  maxCornerRadius: 140,   // Max bend radius for corners
  
  // Main line appearance
  mainOpacity: 0.45,
  mainOpacityActive: 0.85,
  mainOpacityHistorical: 0.22,
  
  // Glow line appearance
  glowOpacity: 0.18,
  glowOpacityActive: 0.35,
  
  // Pulse particle
  pulseSpeed: 0.3,
  pulseSpeedVariance: 0.2,
  pulseSize: 3,
  pulseOpacity: 0.9,
  pulseFadeZone: 0.15,
  
  // Path aging
  maxAge: 20,             // Paths older than N steps fade
  ageFadeStart: 5,        // Begin fading after N steps
  minOpacity: 0.15,
};

/**
 * Build a metro-style (orthogonal with rounded corners) curve path.
 * Adapted from live-desktop app.js buildSubwayCurve.
 * 
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @returns {THREE.CurvePath<THREE.Vector3>}
 */
export function buildSubwayCurve(start, end) {
  const curvePath = new THREE.CurvePath();
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  
  // Calculate bend radius (smaller of available space or max)
  const minAxis = Math.min(Math.abs(dx), Math.abs(dy));
  const bendTarget = minAxis * 0.45;
  const bendLimit = minAxis * 0.5;
  const bend = Math.min(PATH_CONFIG.maxCornerRadius, Math.min(bendTarget, bendLimit));
  
  // If points are nearly aligned, use a simple line with slight curve
  if (!Number.isFinite(bend) || bend <= 0) {
    // Add a subtle bezier instead of straight line for visual interest
    const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 20
    );
    midPoint.add(offset);
    
    curvePath.add(new THREE.QuadraticBezierCurve3(start.clone(), midPoint, end.clone()));
    curvePath.updateArcLengths();
    return curvePath;
  }
  
  // Determine routing direction (horizontal-first or vertical-first)
  const preferHorizontal = Math.abs(dx) >= Math.abs(dy);
  const signX = Math.sign(dx) || 1;
  const signY = Math.sign(dy) || 1;
  const zAtCorner = start.z + dz * 0.52;
  
  if (preferHorizontal) {
    // Route: horizontal → corner → vertical
    const corner = new THREE.Vector3(end.x, start.y, zAtCorner);
    const preCorner = new THREE.Vector3(
      corner.x - signX * bend,
      corner.y,
      start.z + dz * 0.28
    );
    const postCorner = new THREE.Vector3(
      corner.x,
      corner.y + signY * bend,
      start.z + dz * 0.72
    );
    
    curvePath.add(new THREE.LineCurve3(start.clone(), preCorner));
    curvePath.add(new THREE.QuadraticBezierCurve3(preCorner, corner, postCorner));
    curvePath.add(new THREE.LineCurve3(postCorner, end.clone()));
  } else {
    // Route: vertical → corner → horizontal
    const corner = new THREE.Vector3(start.x, end.y, zAtCorner);
    const preCorner = new THREE.Vector3(
      corner.x,
      corner.y - signY * bend,
      start.z + dz * 0.28
    );
    const postCorner = new THREE.Vector3(
      corner.x + signX * bend,
      corner.y,
      start.z + dz * 0.72
    );
    
    curvePath.add(new THREE.LineCurve3(start.clone(), preCorner));
    curvePath.add(new THREE.QuadraticBezierCurve3(preCorner, corner, postCorner));
    curvePath.add(new THREE.LineCurve3(postCorner, end.clone()));
  }
  
  curvePath.updateArcLengths();
  return curvePath;
}

/**
 * Alternative: smooth catmull-rom curve for organic paths.
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @returns {THREE.CurvePath<THREE.Vector3>}
 */
export function buildSmoothCurve(start, end) {
  const curvePath = new THREE.CurvePath();
  
  // Generate intermediate control points
  const distance = start.distanceTo(end);
  const variance = distance * 0.25;
  
  const cp1 = start.clone();
  cp1.x += (Math.random() - 0.5) * variance;
  cp1.y += (Math.random() - 0.5) * variance;
  cp1.z += distance * 0.33 + (Math.random() - 0.5) * variance * 0.5;
  
  const cp2 = end.clone();
  cp2.x += (Math.random() - 0.5) * variance;
  cp2.y += (Math.random() - 0.5) * variance;
  cp2.z -= distance * 0.33 + (Math.random() - 0.5) * variance * 0.5;
  
  const catmull = new THREE.CatmullRomCurve3([
    start.clone(),
    cp1,
    cp2,
    end.clone()
  ], false, 'catmullrom', 0.5);
  
  curvePath.add(catmull);
  curvePath.updateArcLengths();
  return curvePath;
}

/**
 * Create a path connection between two nodes.
 * @param {THREE.Vector3} startPos - Start position
 * @param {THREE.Vector3} endPos - End position
 * @param {object} options
 * @param {boolean} options.isActive - Is this the active path segment
 * @param {number} options.age - How many steps old is this path
 * @param {string} options.curveType - 'subway' or 'smooth'
 * @returns {THREE.Group} Path group containing line and pulse
 */
export function createPath(startPos, endPos, { isActive = false, age = 0, curveType = 'subway' } = {}) {
  const group = new THREE.Group();
  group.userData.type = 'path';
  group.userData.isActive = isActive;
  group.userData.age = age;
  
  // Build the curve
  const curve = curveType === 'subway' 
    ? buildSubwayCurve(startPos, endPos)
    : buildSmoothCurve(startPos, endPos);
  
  group.userData.curve = curve;
  
  // Determine color and opacity based on age
  let color = PATH_COLORS.nominal;
  let opacity = PATH_CONFIG.mainOpacity;
  let glowOpacity = PATH_CONFIG.glowOpacity;
  
  if (isActive) {
    color = PATH_COLORS.active;
    opacity = PATH_CONFIG.mainOpacityActive;
    glowOpacity = PATH_CONFIG.glowOpacityActive;
  } else if (age > PATH_CONFIG.ageFadeStart) {
    const fadeProgress = (age - PATH_CONFIG.ageFadeStart) / (PATH_CONFIG.maxAge - PATH_CONFIG.ageFadeStart);
    opacity = Math.max(PATH_CONFIG.minOpacity, PATH_CONFIG.mainOpacity * (1 - fadeProgress));
    glowOpacity = Math.max(0.05, PATH_CONFIG.glowOpacity * (1 - fadeProgress));
    color = age > 10 ? PATH_COLORS.ancient : PATH_COLORS.historical;
  }
  
  // Sample points along the curve
  const points = curve.getSpacedPoints(PATH_CONFIG.divisions);
  
  // Main line geometry
  const mainGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const mainMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const mainLine = new THREE.Line(mainGeometry, mainMaterial);
  mainLine.userData.role = 'mainLine';
  group.add(mainLine);
  
  // Glow line (rendered behind, wider appearance through bloom)
  const glowMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: glowOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const glowLine = new THREE.Line(mainGeometry.clone(), glowMaterial);
  glowLine.userData.role = 'glowLine';
  group.add(glowLine);
  
  // Pulse particle (travels along the path)
  const pulseGeometry = new THREE.SphereGeometry(PATH_CONFIG.pulseSize, 8, 6);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: PATH_CONFIG.pulseOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const pulseMesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
  pulseMesh.userData.role = 'pulse';
  pulseMesh.visible = isActive || age < 3; // Only show pulse on recent paths
  group.add(pulseMesh);
  
  // Store pulse animation data
  group.userData.pulseOffset = Math.random();
  group.userData.pulseSpeed = PATH_CONFIG.pulseSpeed + (Math.random() - 0.5) * PATH_CONFIG.pulseSpeedVariance;
  
  // Store materials for updates
  group.userData.materials = {
    main: mainMaterial,
    glow: glowMaterial,
    pulse: pulseMaterial,
  };
  
  return group;
}

/**
 * Animate path pulse traveling along the curve.
 * @param {THREE.Group} pathGroup - The path group
 * @param {number} time - Current time in ms
 */
export function animatePathPulse(pathGroup, time) {
  const curve = pathGroup.userData.curve;
  const pulseMesh = pathGroup.children.find(c => c.userData.role === 'pulse');
  
  if (!curve || !pulseMesh || !pulseMesh.visible) return;
  
  const speed = pathGroup.userData.pulseSpeed;
  const offset = pathGroup.userData.pulseOffset;
  
  // Calculate position along path (0-1)
  const t = ((time * 0.001 * speed + offset) % 1);
  
  // Get position on curve
  try {
    const point = curve.getPointAt(t);
    if (point) {
      pulseMesh.position.copy(point);
    }
  } catch (e) {
    // Curve might be invalid, skip this frame
    return;
  }
  
  // Fade at endpoints
  const fadeZone = PATH_CONFIG.pulseFadeZone;
  let opacity = PATH_CONFIG.pulseOpacity;
  
  if (t < fadeZone) {
    opacity = (t / fadeZone) * PATH_CONFIG.pulseOpacity;
  } else if (t > 1 - fadeZone) {
    opacity = ((1 - t) / fadeZone) * PATH_CONFIG.pulseOpacity;
  }
  
  pulseMesh.material.opacity = opacity;
  
  // Scale pulse based on position (larger in middle)
  const scale = 0.8 + Math.sin(t * Math.PI) * 0.4;
  pulseMesh.scale.setScalar(scale);
}

/**
 * Update path visual state.
 * @param {THREE.Group} pathGroup - The path group
 * @param {object} state
 * @param {boolean} state.isActive
 * @param {number} state.age
 */
export function updatePathState(pathGroup, { isActive = false, age = 0 } = {}) {
  const materials = pathGroup.userData.materials;
  if (!materials) return;
  
  let color = PATH_COLORS.nominal;
  let opacity = PATH_CONFIG.mainOpacity;
  let glowOpacity = PATH_CONFIG.glowOpacity;
  
  if (isActive) {
    color = PATH_COLORS.active;
    opacity = PATH_CONFIG.mainOpacityActive;
    glowOpacity = PATH_CONFIG.glowOpacityActive;
  } else if (age > PATH_CONFIG.ageFadeStart) {
    const fadeProgress = Math.min(1, (age - PATH_CONFIG.ageFadeStart) / (PATH_CONFIG.maxAge - PATH_CONFIG.ageFadeStart));
    opacity = Math.max(PATH_CONFIG.minOpacity, PATH_CONFIG.mainOpacity * (1 - fadeProgress));
    glowOpacity = Math.max(0.05, PATH_CONFIG.glowOpacity * (1 - fadeProgress));
    color = age > 10 ? PATH_COLORS.ancient : PATH_COLORS.historical;
  }
  
  materials.main.color.setHex(color);
  materials.main.opacity = opacity;
  materials.glow.color.setHex(color);
  materials.glow.opacity = glowOpacity;
  materials.pulse.color.setHex(color);
  
  // Update pulse visibility
  const pulseMesh = pathGroup.children.find(c => c.userData.role === 'pulse');
  if (pulseMesh) {
    pulseMesh.visible = isActive || age < 3;
  }
  
  pathGroup.userData.isActive = isActive;
  pathGroup.userData.age = age;
}

/**
 * Create a "path draw" animation (path draws from start to end).
 * @param {THREE.Group} pathGroup - The path group
 * @returns {object} Animation controller
 */
export function createPathDrawAnimation(pathGroup) {
  const duration = 600;
  const startTime = performance.now();
  const curve = pathGroup.userData.curve;
  
  // Get the main line for animation
  const mainLine = pathGroup.children.find(c => c.userData.role === 'mainLine');
  const glowLine = pathGroup.children.find(c => c.userData.role === 'glowLine');
  
  if (!mainLine || !curve) {
    return { isComplete: true, update() {} };
  }
  
  // Store original points
  const fullPoints = curve.getSpacedPoints(PATH_CONFIG.divisions);
  
  return {
    isComplete: false,
    update(currentTime) {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Ease out
      const eased = 1 - Math.pow(1 - t, 2);
      
      // Calculate how many points to show
      const pointCount = Math.max(2, Math.floor(eased * fullPoints.length));
      const visiblePoints = fullPoints.slice(0, pointCount);
      
      // Update geometry
      const newGeometry = new THREE.BufferGeometry().setFromPoints(visiblePoints);
      
      mainLine.geometry.dispose();
      mainLine.geometry = newGeometry;
      
      if (glowLine) {
        glowLine.geometry.dispose();
        glowLine.geometry = newGeometry.clone();
      }
      
      if (t >= 1) {
        this.isComplete = true;
      }
    }
  };
}

/**
 * Dispose of a path and free resources.
 * @param {THREE.Group} pathGroup - The path group
 */
export function disposePath(pathGroup) {
  pathGroup.children.forEach((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      child.material.dispose();
    }
  });
  
  pathGroup.clear();
  pathGroup.userData.curve = null;
}

export default {
  createPath,
  buildSubwayCurve,
  buildSmoothCurve,
  animatePathPulse,
  updatePathState,
  createPathDrawAnimation,
  disposePath,
  PATH_COLORS,
};
