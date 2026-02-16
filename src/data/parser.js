/**
 * Session Parser — Parses OpenClaw session .jsonl files into PromptNode arrays
 * @module data/parser
 */

import { calculateMetrics, createTopicSignature, computeTopicOverlap } from './metrics.js';
import { computeSessionShape } from './session-shape.js';
import { createOutcomeLink } from './outcome-link.js';

/**
 * @typedef {Object} ContentBlock
 * @property {string} type - Content type (text, thinking, toolCall, etc.)
 * @property {string} [text] - Text content
 * @property {string} [thinking] - Thinking content
 * @property {string} [id] - Tool call ID
 * @property {string} [name] - Tool name
 * @property {Object} [arguments] - Tool arguments
 */

/**
 * @typedef {Object} Message
 * @property {string} role - Message role (user, assistant, toolResult)
 * @property {ContentBlock[]} content - Message content blocks
 * @property {number} [timestamp] - Unix timestamp (ms)
 */

/**
 * @typedef {Object} SessionEntry
 * @property {string} type - Entry type (session, message, model_change, etc.)
 * @property {string} id - Entry ID
 * @property {string} [parentId] - Parent entry ID
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {Message} [message] - Message data (for type: "message")
 */

/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} PromptMetrics
 * @property {number} charCount - Total characters
 * @property {number} wordCount - Word count
 * @property {number} tokenEstimate - Estimated tokens (chars / 4)
 * @property {number} toolCallCount - Number of tools called in response
 * @property {string[]} toolTypes - Unique tool names used
 * @property {number} responseLatencyMs - Time from prompt to response
 * @property {number|null} similarityToPrev - Cosine similarity to previous prompt
 * @property {number|null} topicDriftScore - Topic drift indicator
 * @property {number} complexityScore - Derived complexity score (0-100)
 * @property {number} focusScore - Focus vs scatter score (0-1)
 * @property {number} sentenceCount - Number of sentences
 * @property {number} questionCount - Number of questions
 * @property {number} thinkingIntensity - Thinking block intensity (0-1)
 */

/**
 * @typedef {Object} PromptNode
 * @property {string} id - Unique identifier
 * @property {number} index - Sequential position in session
 * @property {string} text - Raw prompt text
 * @property {string} textPreview - Truncated preview (first 120 chars)
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {PromptMetrics} metrics - Calculated metrics
 * @property {Vector3} position - Spatial position (computed by viz engine)
 * @property {string|null} prevId - Previous node ID
 * @property {string|null} nextId - Next node ID
 */

/**
 * @typedef {Object} SessionMeta
 * @property {string} sessionId - Session identifier
 * @property {number} startTime - First prompt timestamp
 * @property {number} endTime - Last prompt timestamp
 * @property {number} nodeCount - Total prompts
 * @property {number} totalTokens - Sum of all token estimates
 * @property {number} avgComplexity - Mean complexity score
 * @property {number} maxComplexity - Peak complexity
 * @property {number} avgLatency - Mean response latency
 * @property {string[]} toolsUsed - All unique tools across session
 */

/**
 * @typedef {Object} ParseError
 * @property {number} line - Line number (1-indexed)
 * @property {string} message - Error description
 * @property {string} [raw] - Raw line content
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing succeeded
 * @property {PromptNode[]} nodes - Parsed prompt nodes
 * @property {SessionMeta} meta - Session metadata
 * @property {import('./session-shape.js').SessionShape} shape - Session-level shape descriptors
 * @property {import('./outcome-link.js').OutcomeLink} outcomeLink - Outcome link scaffold
 * @property {ParseError[]} errors - Non-fatal parse issues
 */

/**
 * Truncate text to a preview with ellipsis
 * @param {string} text - Full text
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated text
 */
function createPreview(text, maxLen = 120) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen).trim() + '…';
}

/**
 * Extract text content from message content blocks
 * @param {ContentBlock[]} content - Content blocks array
 * @returns {string} Extracted text
 */
function extractTextContent(content) {
  if (!Array.isArray(content)) return '';
  
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text || '')
    .join('\n')
    .trim();
}

/**
 * Extract tool calls from assistant message content blocks
 * @param {ContentBlock[]} content - Content blocks array
 * @returns {{name: string}[]} Tool calls with name
 */
function extractToolCalls(content) {
  if (!Array.isArray(content)) return [];
  
  return content
    .filter(block => block.type === 'toolCall')
    .map(block => ({ name: block.name || 'unknown' }));
}

/**
 * Extract thinking blocks from assistant message
 * @param {ContentBlock[]} content - Content blocks array
 * @returns {{text: string, length: number}[]} Thinking blocks
 */
function extractThinkingBlocks(content) {
  if (!Array.isArray(content)) return [];
  
  return content
    .filter(block => block.type === 'thinking')
    .map(block => ({
      text: block.thinking || '',
      length: (block.thinking || '').length
    }));
}

/**
 * Parse a single JSONL line safely
 * @param {string} line - JSON line
 * @param {number} lineNum - Line number for error reporting
 * @returns {{entry: SessionEntry|null, error: ParseError|null}}
 */
function parseLine(line, lineNum) {
  const trimmed = line.trim();
  if (!trimmed) return { entry: null, error: null };
  
  try {
    const entry = JSON.parse(trimmed);
    return { entry, error: null };
  } catch (err) {
    return {
      entry: null,
      error: {
        line: lineNum,
        message: `Invalid JSON: ${err.message}`,
        raw: trimmed.substring(0, 100)
      }
    };
  }
}

/**
 * Find the assistant response following a user message
 * @param {SessionEntry[]} entries - All parsed entries
 * @param {number} userIndex - Index of user message
 * @returns {{latencyMs: number, toolCalls: {name: string}[], thinkingBlocks: {text: string, length: number}[]}}
 */
function findAssistantResponse(entries, userIndex) {
  const userEntry = entries[userIndex];
  const userTimestamp = new Date(userEntry.timestamp).getTime();
  
  let latencyMs = 0;
  const toolCalls = [];
  const thinkingBlocks = [];
  
  // Look for assistant messages that are children of this user message
  // or come after it in sequence
  for (let i = userIndex + 1; i < entries.length; i++) {
    const entry = entries[i];
    
    // Stop if we hit the next user message
    if (entry.type === 'message' && entry.message?.role === 'user') {
      break;
    }
    
    if (entry.type === 'message' && entry.message?.role === 'assistant') {
      const responseTimestamp = new Date(entry.timestamp).getTime();
      
      // Calculate latency from user message to first assistant response
      if (latencyMs === 0) {
        latencyMs = responseTimestamp - userTimestamp;
      }
      
      // Collect tool calls
      toolCalls.push(...extractToolCalls(entry.message.content));
      
      // Collect thinking blocks
      thinkingBlocks.push(...extractThinkingBlocks(entry.message.content));
    }
  }
  
  return { latencyMs: Math.max(0, latencyMs), toolCalls, thinkingBlocks };
}

/**
 * Parse an OpenClaw session JSONL file into PromptNodes
 * @param {string} jsonlPath - Path or URL to .jsonl session file
 * @returns {Promise<ParseResult>} Parse result with nodes and metadata
 */
export async function parseSession(jsonlPath) {
  const errors = [];
  const nodes = [];
  
  // Read file (browser-compatible using fetch)
  let content;
  try {
    const response = await fetch(jsonlPath);
    if (!response.ok) {
      return {
        success: false,
        nodes: [],
        meta: createEmptyMeta(jsonlPath),
        errors: [{ line: 0, message: `HTTP ${response.status}: ${response.statusText}` }]
      };
    }
    content = await response.text();
  } catch (err) {
    return {
      success: false,
      nodes: [],
      meta: createEmptyMeta(jsonlPath),
      errors: [{ line: 0, message: `Failed to fetch file: ${err.message}` }]
    };
  }
  
  // Parse all lines first
  const lines = content.split('\n');
  const entries = [];
  
  for (let i = 0; i < lines.length; i++) {
    const { entry, error } = parseLine(lines[i], i + 1);
    if (error) {
      errors.push(error);
    } else if (entry) {
      entries.push(entry);
    }
  }
  
  // Extract session ID from first entry or filename
  let sessionId = jsonlPath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
  const sessionEntry = entries.find(e => e.type === 'session');
  if (sessionEntry?.id) {
    sessionId = sessionEntry.id;
  }
  
  // Find all user messages
  const userMessageIndices = [];
  entries.forEach((entry, idx) => {
    if (entry.type === 'message' && entry.message?.role === 'user') {
      userMessageIndices.push(idx);
    }
  });
  
  // Process each user message into a PromptNode
  let prevTopicSignature = null;
  
  for (let i = 0; i < userMessageIndices.length; i++) {
    const entryIndex = userMessageIndices[i];
    const entry = entries[entryIndex];
    const message = entry.message;
    
    // Extract text content
    const text = extractTextContent(message.content);
    if (!text) continue; // Skip empty messages
    
    // Get timestamp
    const timestamp = new Date(entry.timestamp).getTime();
    
    // Find associated assistant response
    const { latencyMs, toolCalls, thinkingBlocks } = findAssistantResponse(entries, entryIndex);
    
    // Calculate topic signature for overlap computation
    const topicSignature = createTopicSignature(text);
    const topicOverlap = prevTopicSignature 
      ? computeTopicOverlap(prevTopicSignature, topicSignature)
      : 0.5; // Default for first prompt
    
    // Calculate all metrics
    const metrics = calculateMetrics(text, latencyMs, toolCalls, thinkingBlocks, topicOverlap);
    
    // Create node
    const node = {
      id: entry.id,
      index: nodes.length,
      text,
      textPreview: createPreview(text),
      timestamp,
      metrics,
      position: { x: 0, y: 0, z: 0 }, // Computed by viz engine
      prevId: nodes.length > 0 ? nodes[nodes.length - 1].id : null,
      nextId: null // Will be set after loop
    };
    
    // Link previous node to this one
    if (nodes.length > 0) {
      nodes[nodes.length - 1].nextId = node.id;
    }
    
    nodes.push(node);
    prevTopicSignature = topicSignature;
  }
  
  // Build metadata
  const meta = buildSessionMeta(sessionId, nodes);

  // Compute session shape (the at-a-glance insight)
  const shape = computeSessionShape(nodes);

  // Create outcome link scaffold (to be populated with git/repo data later)
  const outcomeLink = createOutcomeLink(sessionId);

  return {
    success: nodes.length > 0,
    nodes,
    meta,
    shape,
    outcomeLink,
    errors
  };
}

/**
 * Create empty session metadata
 * @param {string} sessionId - Session identifier
 * @returns {SessionMeta}
 */
function createEmptyMeta(sessionId) {
  return {
    sessionId: sessionId.split('/').pop()?.replace('.jsonl', '') || 'unknown',
    startTime: 0,
    endTime: 0,
    nodeCount: 0,
    totalTokens: 0,
    avgComplexity: 0,
    maxComplexity: 0,
    avgLatency: 0,
    toolsUsed: []
  };
}

/**
 * Build session metadata from parsed nodes
 * @param {string} sessionId - Session identifier
 * @param {PromptNode[]} nodes - Parsed prompt nodes
 * @returns {SessionMeta}
 */
function buildSessionMeta(sessionId, nodes) {
  if (nodes.length === 0) {
    return createEmptyMeta(sessionId);
  }
  
  const allTools = new Set();
  let totalComplexity = 0;
  let maxComplexity = 0;
  let totalLatency = 0;
  let totalTokens = 0;
  
  for (const node of nodes) {
    const m = node.metrics;
    
    totalTokens += m.tokenEstimate;
    totalComplexity += m.complexityScore;
    maxComplexity = Math.max(maxComplexity, m.complexityScore);
    totalLatency += m.responseLatencyMs;
    
    m.toolTypes.forEach(t => allTools.add(t));
  }
  
  return {
    sessionId,
    startTime: nodes[0].timestamp,
    endTime: nodes[nodes.length - 1].timestamp,
    nodeCount: nodes.length,
    totalTokens,
    avgComplexity: Math.round(totalComplexity / nodes.length),
    maxComplexity,
    avgLatency: Math.round(totalLatency / nodes.length),
    toolsUsed: [...allTools].sort()
  };
}

/**
 * Parse session from raw JSONL string content
 * @param {string} jsonlContent - Raw JSONL content
 * @param {string} [sessionId] - Optional session ID
 * @returns {ParseResult} Parse result
 */
export function parseSessionFromString(jsonlContent, sessionId = 'inline') {
  const errors = [];
  const nodes = [];
  const entries = [];
  
  const lines = jsonlContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const { entry, error } = parseLine(lines[i], i + 1);
    if (error) {
      errors.push(error);
    } else if (entry) {
      entries.push(entry);
    }
  }
  
  // Extract session ID from content if available
  const sessionEntry = entries.find(e => e.type === 'session');
  if (sessionEntry?.id) {
    sessionId = sessionEntry.id;
  }
  
  // Find all user messages
  const userMessageIndices = [];
  entries.forEach((entry, idx) => {
    if (entry.type === 'message' && entry.message?.role === 'user') {
      userMessageIndices.push(idx);
    }
  });
  
  // Process each user message
  let prevTopicSignature = null;
  
  for (let i = 0; i < userMessageIndices.length; i++) {
    const entryIndex = userMessageIndices[i];
    const entry = entries[entryIndex];
    const message = entry.message;
    
    const text = extractTextContent(message.content);
    if (!text) continue;
    
    const timestamp = new Date(entry.timestamp).getTime();
    const { latencyMs, toolCalls, thinkingBlocks } = findAssistantResponse(entries, entryIndex);
    
    const topicSignature = createTopicSignature(text);
    const topicOverlap = prevTopicSignature 
      ? computeTopicOverlap(prevTopicSignature, topicSignature)
      : 0.5;
    
    const metrics = calculateMetrics(text, latencyMs, toolCalls, thinkingBlocks, topicOverlap);
    
    const node = {
      id: entry.id,
      index: nodes.length,
      text,
      textPreview: createPreview(text),
      timestamp,
      metrics,
      position: { x: 0, y: 0, z: 0 },
      prevId: nodes.length > 0 ? nodes[nodes.length - 1].id : null,
      nextId: null
    };
    
    if (nodes.length > 0) {
      nodes[nodes.length - 1].nextId = node.id;
    }
    
    nodes.push(node);
    prevTopicSignature = topicSignature;
  }
  
  const meta = buildSessionMeta(sessionId, nodes);
  const shape = computeSessionShape(nodes);
  const outcomeLink = createOutcomeLink(sessionId);

  return {
    success: nodes.length > 0,
    nodes,
    meta,
    shape,
    outcomeLink,
    errors
  };
}

export default {
  parseSession,
  parseSessionFromString
};
