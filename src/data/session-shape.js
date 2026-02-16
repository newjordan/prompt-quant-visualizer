/**
 * Session Shape Analysis — Computes session-level shape descriptors
 * @module data/session-shape
 *
 * The shape of a session IS the insight. A focused developer's session
 * looks like tight beads on a string. An exploratory/ADD session looks
 * like a neural map with loops and tangents. This module computes the
 * numbers that drive that visual distinction.
 *
 * These descriptors are designed for at-a-glance classification:
 * look at the starmap shape and immediately know what kind of session it was.
 */

/**
 * @typedef {Object} SessionShape
 * @property {number} linearity    - 0-1: How direct/on-topic the conversation stayed.
 *                                   1 = laser focused, 0 = all over the place.
 * @property {number} density      - 0-1: How consistent the node metrics are.
 *                                   High = tight uniform beads, Low = wild variance.
 * @property {number} rhythm       - 0-1: How regular the cadence is.
 *                                   High = steady drumbeat, Low = erratic bursts.
 * @property {number} breadth      - 0-1: How many different tools/topics touched.
 *                                   0 = single-tool single-topic, 1 = everything.
 * @property {number} convergence  - -1 to 1: Does the session narrow or expand?
 *                                   Positive = converging toward a goal.
 *                                   Negative = diverging into exploration.
 * @property {number} momentum     - 0-1: Is complexity building over time?
 *                                   High = escalating, Low = front-loaded or flat.
 * @property {string} classification - Human-readable session type label.
 * @property {number} nodeCount    - Number of prompts in the session.
 * @property {number} durationMs   - Wall-clock session duration.
 * @property {number[]} driftProfile - Per-node drift values for sparkline rendering.
 * @property {number[]} complexityProfile - Per-node complexity for sparkline rendering.
 */

/**
 * Clamp a value between min and max.
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute standard deviation of an array of numbers.
 */
function stddev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Compute the mean of an array.
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Compute linear regression slope (normalized).
 * Returns a value indicating trend direction and strength.
 * @param {number[]} values
 * @returns {number} Slope normalized to roughly -1..1
 */
function trendSlope(values) {
  if (values.length < 3) return 0;

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    numerator += dx * (values[i] - yMean);
    denominator += dx * dx;
  }

  if (denominator === 0) return 0;

  const slope = numerator / denominator;
  // Normalize by the range of y values so we get a relative measure
  const range = Math.max(...values) - Math.min(...values);
  if (range === 0) return 0;

  return clamp(slope / range * n, -1, 1);
}

/**
 * Compute session shape from an array of parsed PromptNodes.
 *
 * @param {import('./parser.js').PromptNode[]} nodes - Parsed prompt nodes with metrics
 * @returns {SessionShape}
 */
export function computeSessionShape(nodes) {
  if (!nodes || nodes.length === 0) {
    return emptyShape();
  }

  if (nodes.length === 1) {
    return singleNodeShape(nodes[0]);
  }

  // Extract metric arrays
  const drifts = [];
  const complexities = [];
  const latencies = [];
  const tokenCounts = [];
  const focusScores = [];
  const toolCounts = [];
  const allToolTypes = new Set();
  const allToolCategories = new Set();

  for (const node of nodes) {
    const m = node.metrics;
    if (!m) continue;

    drifts.push(m.topicDriftScore ?? 0);
    complexities.push(m.complexityScore ?? 0);
    latencies.push(m.responseLatencyMs ?? 0);
    tokenCounts.push(m.tokenEstimate ?? 0);
    focusScores.push(m.focusScore ?? 0.5);
    toolCounts.push(m.toolCallCount ?? 0);

    if (m.toolTypes) m.toolTypes.forEach(t => allToolTypes.add(t));
    if (m.toolCategories) m.toolCategories.forEach(c => allToolCategories.add(c));
  }

  // --- LINEARITY ---
  // Low topic drift throughout = high linearity
  // Mean drift close to 0 = straight path, high drift = winding
  const avgDrift = mean(drifts);
  const linearity = clamp(1 - avgDrift * 1.5, 0, 1);

  // --- DENSITY ---
  // Low variance in complexity and token counts = tight beads
  // High variance = some nodes huge, some tiny
  const complexityCV = mean(complexities) > 0
    ? stddev(complexities) / mean(complexities)
    : 0;
  const tokenCV = mean(tokenCounts) > 0
    ? stddev(tokenCounts) / mean(tokenCounts)
    : 0;
  const density = clamp(1 - (complexityCV * 0.6 + tokenCV * 0.4), 0, 1);

  // --- RHYTHM ---
  // Consistent latency and token length = steady beat
  // Wild variance = erratic session
  const latencyCV = mean(latencies) > 0
    ? stddev(latencies) / mean(latencies)
    : 0;
  const rhythm = clamp(1 - latencyCV * 0.7, 0, 1);

  // --- BREADTH ---
  // How many different tool categories + topic spread
  // More categories = broader session
  const maxCategories = 7; // from metrics.js TOOL_CATEGORIES
  const categoryBreadth = allToolCategories.size / maxCategories;
  const driftSpread = stddev(drifts); // High stddev = visited many different topics
  const breadth = clamp(categoryBreadth * 0.5 + driftSpread * 0.5, 0, 1);

  // --- CONVERGENCE ---
  // Compare first-half drift to second-half drift.
  // If drift decreases over time, the session is converging.
  // If drift increases, it's diverging.
  const halfPoint = Math.floor(drifts.length / 2);
  const firstHalfDrift = mean(drifts.slice(0, halfPoint || 1));
  const secondHalfDrift = mean(drifts.slice(halfPoint));
  const driftDelta = firstHalfDrift - secondHalfDrift;
  // Also check if focus scores increase (another convergence signal)
  const focusTrend = trendSlope(focusScores);
  const convergence = clamp(
    driftDelta * 0.6 + focusTrend * 0.4,
    -1, 1
  );

  // --- MOMENTUM ---
  // Is complexity building over the session?
  const complexityTrend = trendSlope(complexities);
  const momentum = clamp((complexityTrend + 1) / 2, 0, 1); // Map -1..1 to 0..1

  // --- CLASSIFICATION ---
  const classification = classifySession({
    linearity, density, rhythm, breadth, convergence, momentum,
    nodeCount: nodes.length, avgFocus: mean(focusScores)
  });

  // --- DURATION ---
  const timestamps = nodes.map(n => n.timestamp).filter(t => t > 0);
  const durationMs = timestamps.length >= 2
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;

  return {
    linearity:  round2(linearity),
    density:    round2(density),
    rhythm:     round2(rhythm),
    breadth:    round2(breadth),
    convergence: round2(convergence),
    momentum:   round2(momentum),
    classification,
    nodeCount: nodes.length,
    durationMs,
    driftProfile: drifts.map(d => round2(d)),
    complexityProfile: complexities.map(c => Math.round(c)),
  };
}

/**
 * Classify a session based on shape descriptors.
 */
function classifySession({ linearity, density, rhythm, breadth, convergence, momentum, nodeCount, avgFocus }) {
  // Focused Build: tight, linear, consistent, converging
  if (linearity > 0.6 && density > 0.5 && convergence > 0 && avgFocus > 0.5) {
    return 'focused-build';
  }

  // Research Spiral: broad, diverging, growing complexity
  if (breadth > 0.4 && convergence < -0.1 && momentum > 0.5) {
    return 'research-spiral';
  }

  // Collaborative Discovery: moderate everything, some drift, some focus
  if (linearity > 0.3 && linearity < 0.7 && breadth > 0.2 && rhythm > 0.3) {
    return 'collaborative-discovery';
  }

  // Sprint: short, fast, high momentum, linear
  if (nodeCount <= 8 && linearity > 0.5 && momentum > 0.4) {
    return 'sprint';
  }

  // Exploratory: high drift, low convergence, moderate breadth
  if (linearity < 0.4 && breadth > 0.3 && Math.abs(convergence) < 0.2) {
    return 'exploratory';
  }

  // Scattered: low everything — no clear direction
  if (linearity < 0.35 && density < 0.4 && rhythm < 0.4) {
    return 'scattered';
  }

  // Default fallback
  return 'mixed';
}

/**
 * Classification labels and descriptions for UI rendering.
 */
export const SESSION_CLASSIFICATIONS = {
  'focused-build': {
    label: 'Focused Build',
    description: 'Tight, linear session driving toward a specific outcome.',
    color: 0x00FFCC,
  },
  'research-spiral': {
    label: 'Research Spiral',
    description: 'Widening exploration with escalating complexity.',
    color: 0xAA44FF,
  },
  'collaborative-discovery': {
    label: 'Collaborative Discovery',
    description: 'Back-and-forth problem solving with balanced exploration.',
    color: 0x3B82F6,
  },
  'sprint': {
    label: 'Sprint',
    description: 'Short, targeted burst of focused work.',
    color: 0x22D3EE,
  },
  'exploratory': {
    label: 'Exploratory',
    description: 'Wide-ranging investigation without a fixed target.',
    color: 0xFFD085,
  },
  'scattered': {
    label: 'Scattered',
    description: 'No clear direction — topics, complexity, and rhythm all over the place.',
    color: 0xFF8080,
  },
  'mixed': {
    label: 'Mixed',
    description: 'Doesn\'t fit a clean pattern — multiple phases or style shifts.',
    color: 0x8899AA,
  },
};

function round2(v) {
  return Math.round(v * 100) / 100;
}

function emptyShape() {
  return {
    linearity: 0, density: 0, rhythm: 0, breadth: 0,
    convergence: 0, momentum: 0.5,
    classification: 'mixed',
    nodeCount: 0, durationMs: 0,
    driftProfile: [], complexityProfile: [],
  };
}

function singleNodeShape(node) {
  const m = node.metrics || {};
  return {
    linearity: 1, density: 1, rhythm: 1, breadth: 0,
    convergence: 0, momentum: 0.5,
    classification: 'sprint',
    nodeCount: 1, durationMs: 0,
    driftProfile: [m.topicDriftScore ?? 0],
    complexityProfile: [m.complexityScore ?? 0],
  };
}

export default {
  computeSessionShape,
  SESSION_CLASSIFICATIONS,
};
