/**
 * Data Layer — Session parsing and metrics calculation
 * @module data
 * 
 * Provides a clean API for loading and processing OpenClaw session files.
 * 
 * @example
 * import { parseSession, parseSessionFromString } from './data/index.js';
 * 
 * // Parse from file path
 * const result = await parseSession('/path/to/session.jsonl');
 * if (result.success) {
 *   console.log('Loaded', result.nodes.length, 'prompts');
 *   result.nodes.forEach(node => {
 *     console.log(`[${node.index}] ${node.textPreview}`);
 *     console.log(`  Complexity: ${node.metrics.complexityScore}`);
 *     console.log(`  Focus: ${node.metrics.focusScore}`);
 *     console.log(`  Tools: ${node.metrics.toolTypes.join(', ')}`);
 *   });
 * }
 * 
 * // Parse from string content
 * const content = await fetch('/api/session').then(r => r.text());
 * const result2 = parseSessionFromString(content, 'my-session');
 */

// Core parsing functions
export { parseSession, parseSessionFromString } from './parser.js';

// Metrics calculation functions
export {
  estimateTokens,
  countWords,
  countSentences,
  countQuestions,
  extractKeywords,
  createTopicSignature,
  computeTopicOverlap,
  computeFocusScore,
  calculateComplexity,
  calculateMetrics,
  calculateToolDiversity,
  getLatencyBucket,
  computeThinkingIntensity
} from './metrics.js';

// Re-export types via JSDoc for documentation
/**
 * @typedef {import('./parser.js').PromptNode} PromptNode
 * @typedef {import('./parser.js').PromptMetrics} PromptMetrics  
 * @typedef {import('./parser.js').SessionMeta} SessionMeta
 * @typedef {import('./parser.js').ParseResult} ParseResult
 * @typedef {import('./parser.js').ParseError} ParseError
 * @typedef {import('./parser.js').Vector3} Vector3
 * @typedef {import('./metrics.js').TopicKeyword} TopicKeyword
 */

/**
 * Default export with all main functions
 */
export default {
  // Parsing
  parseSession: async (path) => {
    const { parseSession } = await import('./parser.js');
    return parseSession(path);
  },
  parseSessionFromString: async (content, sessionId) => {
    const { parseSessionFromString } = await import('./parser.js');
    return parseSessionFromString(content, sessionId);
  },
  
  // Metrics (re-exported for convenience)
  metrics: async () => {
    return await import('./metrics.js');
  }
};
