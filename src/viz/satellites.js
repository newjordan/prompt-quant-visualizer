/**
 * satellites.js - Satellite/complexity indicators orbiting nodes
 * 
 * Satellites orbit their parent node to represent metrics:
 * - Token count: Sphere (blue)
 * - Tool calls: Cubes (green/orange per type)
 * - Response latency: Tetrahedron (pink)
 * - Topic drift: Sphere (purple)
 */

import * as THREE from 'three';

// === Satellite Color Palette (from art direction guides) ===
export const SATELLITE_COLORS = {
  tokens: 0x00AAFF,       // Blue - token/length
  tools: 0x10B981,        // Green - tool usage  
  latency: 0xFF5A5A,      // Red/pink - response time
  drift: 0xAA44FF,        // Purple - topic drift
  
  // Tool-specific colors
  toolFile: 0xF5A623,     // Amber - file operations
  toolWeb: 0x00D4FF,      // Cyan - web/API calls
  toolBrowser: 0xFF3366,  // Magenta - browser actions
  toolSystem: 0xE8E8E8,   // White - system commands
};

// === Satellite Configuration (from SPEC.md and art direction) ===
const SATELLITE_CONFIG = {
  // Orbit parameters
  baseOrbitRadius: 25,
  orbitSpeed: 0.5,
  orbitTilt: Math.PI * 0.15,  // 27° tilt from equator
  
  // Individual satellite configs
  satellites: [
    {
      metric: 'tokenEstimate',
      orbitRadius: 25,
      orbitSpeed: 0.5,
      shape: 'sphere',
      color: SATELLITE_COLORS.tokens,
      // Scale: 2-10 based on tokens
      scaleMin: 2,
      scaleMax: 10,
      scaleNormalizer: 500,
    },
    {
      metric: 'toolCallCount',
      orbitRadius: 35,
      orbitSpeed: -0.7,  // Opposite direction
      shape: 'cube',
      color: SATELLITE_COLORS.tools,
      // Each tool adds 3 to size
      scaleMin: 2,
      scalePerTool: 3,
    },
    {
      metric: 'responseLatencyMs',
      orbitRadius: 45,
      orbitSpeed: 0.3,
      shape: 'tetrahedron',
      color: SATELLITE_COLORS.latency,
      // Scale: 2-8 based on latency (caps at 10s)
      scaleMin: 2,
      scaleMax: 8,
      scaleNormalizer: 10000,
    },
    {
      metric: 'topicDriftScore',
      orbitRadius: 55,
      orbitSpeed: -0.4,
      shape: 'sphere',
      color: SATELLITE_COLORS.drift,
      // Scale: 2-10 based on drift (0-1)
      scaleMin: 2,
      scaleMax: 10,
      scaleNormalizer: 1,
    },
  ],
  
  // Animation
  pulseCycle: 3000,
  pulseAmplitude: 0.15,
  
  // Material
  opacity: 0.65,
  glowOpacity: 0.25,
};

/**
 * Create satellite geometry based on shape type.
 * @param {string} shape - Shape type
 * @param {number} size - Satellite size
 * @returns {THREE.BufferGeometry}
 */
function createSatelliteGeometry(shape, size) {
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(size, 8, 6);
    case 'cube':
      return new THREE.BoxGeometry(size, size, size);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(size);
    default:
      return new THREE.SphereGeometry(size, 8, 6);
  }
}

/**
 * Create satellite material with glow.
 * @param {number} color - Hex color
 * @returns {THREE.MeshBasicMaterial}
 */
function createSatelliteMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: SATELLITE_CONFIG.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Calculate satellite size from metric value.
 * @param {object} config - Satellite config
 * @param {number} value - Metric value
 * @returns {number} Satellite size
 */
function calculateSatelliteSize(config, value) {
  if (value === null || value === undefined) {
    return config.scaleMin;
  }
  
  if (config.scalePerTool !== undefined) {
    // Tool count: linear scaling
    return config.scaleMin + value * config.scalePerTool;
  }
  
  // Normalized scaling
  const normalized = Math.min(value / config.scaleNormalizer, 1);
  return config.scaleMin + normalized * (config.scaleMax - config.scaleMin);
}

/**
 * Create a single satellite mesh.
 * @param {object} config - Satellite config
 * @param {number} value - Metric value
 * @returns {THREE.Mesh}
 */
function createSatellite(config, value) {
  const size = calculateSatelliteSize(config, value);
  const geometry = createSatelliteGeometry(config.shape, size);
  const material = createSatelliteMaterial(config.color);
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.metric = config.metric;
  mesh.userData.orbitRadius = config.orbitRadius;
  mesh.userData.orbitSpeed = config.orbitSpeed;
  mesh.userData.baseSize = size;
  mesh.userData.value = value;
  
  return mesh;
}

/**
 * Create a group of satellites for a node based on its metrics.
 * @param {object} metrics - PromptMetrics object
 * @returns {THREE.Group} Satellite group with orbit data
 */
export function createSatellites(metrics) {
  const group = new THREE.Group();
  group.userData.type = 'satellites';
  group.userData.orbitPhases = new Map();
  
  for (const config of SATELLITE_CONFIG.satellites) {
    const value = metrics[config.metric];
    
    // Skip satellites for null/zero values (except tools which can be 0)
    if (config.metric !== 'toolCallCount' && (value === null || value === undefined || value === 0)) {
      continue;
    }
    
    // For tool calls, only show if > 0
    if (config.metric === 'toolCallCount' && value === 0) {
      continue;
    }
    
    const satellite = createSatellite(config, value);
    
    // Random initial phase for orbit
    const phase = Math.random() * Math.PI * 2;
    group.userData.orbitPhases.set(satellite.uuid, phase);
    
    // Position on orbit
    const x = config.orbitRadius * Math.cos(phase);
    const y = config.orbitRadius * Math.sin(phase) * Math.sin(config.orbitTilt || SATELLITE_CONFIG.orbitTilt);
    const z = config.orbitRadius * Math.sin(phase) * Math.cos(config.orbitTilt || SATELLITE_CONFIG.orbitTilt);
    satellite.position.set(x, y, z);
    
    group.add(satellite);
  }
  
  // Also create tool-type satellites if there are tool calls
  if (metrics.toolTypes && metrics.toolTypes.length > 0) {
    createToolTypeSatellites(group, metrics.toolTypes);
  }
  
  return group;
}

/**
 * Create individual satellites for each tool type used.
 * @param {THREE.Group} group - Parent group
 * @param {string[]} toolTypes - Array of tool names
 */
function createToolTypeSatellites(group, toolTypes) {
  const orbitRadius = 40;
  const baseSpeed = 0.6;
  
  toolTypes.forEach((toolName, index) => {
    // Determine color by tool type
    let color = SATELLITE_COLORS.tools;
    const nameLower = toolName.toLowerCase();
    
    if (nameLower.includes('read') || nameLower.includes('write') || nameLower.includes('edit')) {
      color = SATELLITE_COLORS.toolFile;
    } else if (nameLower.includes('web') || nameLower.includes('fetch') || nameLower.includes('search')) {
      color = SATELLITE_COLORS.toolWeb;
    } else if (nameLower.includes('browser')) {
      color = SATELLITE_COLORS.toolBrowser;
    } else if (nameLower.includes('exec') || nameLower.includes('process')) {
      color = SATELLITE_COLORS.toolSystem;
    }
    
    const geometry = new THREE.BoxGeometry(3, 3, 3);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    
    const satellite = new THREE.Mesh(geometry, material);
    satellite.userData.metric = 'toolType';
    satellite.userData.toolName = toolName;
    satellite.userData.orbitRadius = orbitRadius;
    satellite.userData.orbitSpeed = baseSpeed * (index % 2 === 0 ? 1 : -1);
    satellite.userData.orbitOffset = (index / toolTypes.length) * Math.PI * 2;
    
    // Initial position
    const phase = satellite.userData.orbitOffset;
    const tilt = Math.PI * 0.2;
    const x = orbitRadius * Math.cos(phase);
    const y = orbitRadius * Math.sin(phase) * Math.sin(tilt);
    const z = orbitRadius * Math.sin(phase) * Math.cos(tilt);
    satellite.position.set(x, y, z);
    
    group.userData.orbitPhases.set(satellite.uuid, phase);
    group.add(satellite);
  });
}

/**
 * Animate satellites in their orbits.
 * @param {THREE.Group} satelliteGroup - The satellite group
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} totalTime - Total elapsed time in ms
 */
export function animateSatellites(satelliteGroup, deltaTime, totalTime) {
  if (!satelliteGroup.userData.orbitPhases) return;
  
  satelliteGroup.children.forEach((satellite) => {
    const orbitRadius = satellite.userData.orbitRadius || SATELLITE_CONFIG.baseOrbitRadius;
    const orbitSpeed = satellite.userData.orbitSpeed || SATELLITE_CONFIG.satellites[0].orbitSpeed;
    const tilt = SATELLITE_CONFIG.orbitTilt;
    
    // Update phase
    let phase = satelliteGroup.userData.orbitPhases.get(satellite.uuid) || 0;
    phase += orbitSpeed * deltaTime;
    satelliteGroup.userData.orbitPhases.set(satellite.uuid, phase);
    
    // Add any per-satellite offset (for tool type satellites)
    const offset = satellite.userData.orbitOffset || 0;
    const totalPhase = phase + offset;
    
    // Calculate position on tilted elliptical orbit
    const x = orbitRadius * Math.cos(totalPhase);
    const y = orbitRadius * Math.sin(totalPhase) * Math.sin(tilt);
    const z = orbitRadius * Math.sin(totalPhase) * Math.cos(tilt);
    satellite.position.set(x, y, z);
    
    // Gentle pulse animation
    const pulseFactor = Math.sin(totalTime / SATELLITE_CONFIG.pulseCycle * Math.PI * 2) * 0.5 + 0.5;
    const scale = 1 + pulseFactor * SATELLITE_CONFIG.pulseAmplitude;
    satellite.scale.setScalar(scale);
    
    // Slight rotation for cubes
    if (satellite.geometry.type === 'BoxGeometry') {
      satellite.rotation.x += deltaTime * 0.5;
      satellite.rotation.y += deltaTime * 0.3;
    }
  });
}

/**
 * Update satellite visibility (expand/contract for focus mode).
 * @param {THREE.Group} satelliteGroup - The satellite group
 * @param {boolean} expanded - Whether satellites should be expanded
 */
export function setSatelliteExpanded(satelliteGroup, expanded) {
  const multiplier = expanded ? 1.6 : 1.0;
  
  satelliteGroup.children.forEach((satellite) => {
    const baseRadius = satellite.userData.orbitRadius || SATELLITE_CONFIG.baseOrbitRadius;
    satellite.userData.orbitRadius = baseRadius * multiplier;
  });
}

/**
 * Create hover label for a satellite.
 * @param {THREE.Mesh} satellite - The satellite mesh
 * @returns {object} Label data { text, metric, value }
 */
export function getSatelliteLabel(satellite) {
  const metric = satellite.userData.metric;
  const value = satellite.userData.value;
  const toolName = satellite.userData.toolName;
  
  const labels = {
    tokenEstimate: `Tokens: ~${value}`,
    toolCallCount: `Tools: ${value}`,
    responseLatencyMs: `Latency: ${(value / 1000).toFixed(1)}s`,
    topicDriftScore: `Drift: ${(value * 100).toFixed(0)}%`,
    toolType: `Tool: ${toolName}`,
  };
  
  return {
    text: labels[metric] || metric,
    metric,
    value,
  };
}

/**
 * Dispose of satellites and free resources.
 * @param {THREE.Group} satelliteGroup - The satellite group
 */
export function disposeSatellites(satelliteGroup) {
  satelliteGroup.children.forEach((satellite) => {
    if (satellite.geometry) {
      satellite.geometry.dispose();
    }
    if (satellite.material) {
      satellite.material.dispose();
    }
  });
  
  satelliteGroup.clear();
  satelliteGroup.userData.orbitPhases?.clear();
}

export default {
  createSatellites,
  animateSatellites,
  setSatelliteExpanded,
  getSatelliteLabel,
  disposeSatellites,
  SATELLITE_COLORS,
};
