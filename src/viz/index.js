/**
 * viz/index.js - Visualization module exports
 * 
 * Exports the StarmapRenderer class and related utilities.
 */

// Main renderer class
export { StarmapRenderer, default } from './starmap.js';

// Node utilities
export {
  createNode,
  updateNodeState,
  animateNodeBreath,
  createNodeBirthAnimation,
  disposeNode,
  getShapeForComplexity,
  createWireframeMaterial,
  NODE_COLORS,
} from './nodes.js';

// Satellite utilities
export {
  createSatellites,
  animateSatellites,
  setSatelliteExpanded,
  getSatelliteLabel,
  disposeSatellites,
  SATELLITE_COLORS,
} from './satellites.js';

// Path utilities
export {
  createPath,
  buildSubwayCurve,
  buildSmoothCurve,
  animatePathPulse,
  updatePathState,
  createPathDrawAnimation,
  disposePath,
  PATH_COLORS,
} from './paths.js';

// Re-export default theme for convenience
export const DEFAULT_THEME = {
  // Node colors
  nodeColor: 0x00FFCC,
  nodeColorActive: 0x7DF4FF,
  nodeColorHover: 0x66FFEE,
  
  // Connection colors
  connectionColor: 0x00FFCC,
  connectionOpacity: 0.45,
  
  // Satellite colors
  satelliteColors: {
    length: 0x00AAFF,
    tools: 0x10B981,
    latency: 0xFF5A5A,
    drift: 0xAA44FF,
  },
  
  // Background
  backgroundColor: 0x040911,
};

// Type definitions (for JSDoc / TypeScript reference)
/**
 * @typedef {Object} PromptNode
 * @property {string} id - Unique identifier
 * @property {number} index - Sequential position in session
 * @property {string} text - Raw prompt text
 * @property {string} textPreview - Truncated preview
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {PromptMetrics} metrics - Calculated metrics
 * @property {Vector3} position - Spatial position
 * @property {string|null} prevId - Previous node ID
 * @property {string|null} nextId - Next node ID
 */

/**
 * @typedef {Object} PromptMetrics
 * @property {number} charCount - Total characters
 * @property {number} wordCount - Word count
 * @property {number} tokenEstimate - Estimated tokens
 * @property {number} toolCallCount - Number of tool calls
 * @property {string[]} toolTypes - Unique tool names
 * @property {number} responseLatencyMs - Response latency
 * @property {number|null} similarityToPrev - Cosine similarity to previous
 * @property {number|null} topicDriftScore - Topic drift indicator
 * @property {number} complexityScore - Derived complexity (0-100)
 */

/**
 * @typedef {Object} StarmapOptions
 * @property {'path'|'cluster'|'spiral'} layout - Spatial layout algorithm
 * @property {number} nodeSpacing - Base distance between nodes
 * @property {number} pathCurvature - How curvy connections are (0-1)
 * @property {StarmapTheme} theme - Color theme
 * @property {number} maxVisibleNodes - LOD cutoff
 * @property {boolean} enableGlow - Post-processing glow
 */

/**
 * @typedef {Object} StarmapTheme
 * @property {number} nodeColor - Default node color
 * @property {number} nodeColorActive - Focused node color
 * @property {number} nodeColorHover - Hovered node color
 * @property {number} connectionColor - Spline color
 * @property {number} connectionOpacity - Spline opacity
 * @property {Object} satelliteColors - Colors for different satellite types
 * @property {number} backgroundColor - Scene background color
 */

/**
 * @typedef {Object} VisibilityOptions
 * @property {boolean} connections - Show connection paths
 * @property {boolean} satellites - Show satellite indicators
 * @property {boolean} labels - Show text labels
 * @property {boolean} grid - Show background grid
 */

/**
 * @typedef {'node:click'|'node:hover'|'node:leave'|'focus:change'|'ready'} StarmapEvent
 */

/**
 * @typedef {Object} NodeEventPayload
 * @property {PromptNode} node - The affected node
 * @property {number} index - Node index
 * @property {{x: number, y: number}} screenPosition - Screen coordinates
 */
