/**
 * Metrics Calculator — Computes all metrics per PromptNode
 * @module data/metrics
 * 
 * Implements calculations from metrics-spec.md
 */

/**
 * Stop words to filter from keyword extraction
 * @type {Set<string>}
 */
const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
  'their', 'what', 'when', 'where', 'which', 'while', 'would',
  'could', 'should', 'about', 'after', 'before', 'being', 'between',
  'both', 'each', 'into', 'just', 'more', 'most', 'other', 'over',
  'same', 'some', 'such', 'than', 'then', 'these', 'through',
  'under', 'very', 'will', 'your', 'also', 'back', 'because',
  'come', 'does', 'down', 'even', 'first', 'good', 'great', 'here',
  'know', 'like', 'look', 'make', 'much', 'need', 'only', 'part',
  'people', 'place', 'right', 'take', 'think', 'want', 'well', 'work',
  'there', 'them', 'then', 'those', 'thing', 'things', 'time',
  'want', 'way', 'ways', 'can', 'cant', 'dont', 'its', 'you',
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him',
  'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way',
  'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
  'file', 'files', 'please', 'using', 'used', 'help', 'sure', 'okay'
]);

/**
 * Tool categories mapping (from metrics-spec.md)
 * @type {Object<string, string>}
 */
const TOOL_CATEGORIES = {
  read: 'filesystem',
  write: 'filesystem', 
  edit: 'filesystem',
  Read: 'filesystem',
  Write: 'filesystem',
  Edit: 'filesystem',
  exec: 'execution',
  process: 'execution',
  browser: 'browser',
  web_search: 'search',
  web_fetch: 'search',
  image: 'media',
  tts: 'media',
  message: 'communication',
  nodes: 'infrastructure',
  canvas: 'infrastructure'
};

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Estimate token count from text
 * Uses ~4 chars per token heuristic (GPT-style)
 * @param {string} text - Input text
 * @returns {number} Estimated tokens
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Count words in text
 * @param {string} text - Input text
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Count sentences in text (regex-based)
 * @param {string} text - Input text
 * @returns {number} Sentence count
 */
export function countSentences(text) {
  if (!text) return 0;
  // Match sentence-ending punctuation followed by space or end
  const matches = text.match(/[.!?]+(?:\s+|$)/g);
  return matches ? matches.length : 1; // At least 1 if text exists
}

/**
 * Count questions in text
 * @param {string} text - Input text
 * @returns {number} Question count
 */
export function countQuestions(text) {
  if (!text) return 0;
  const matches = text.match(/\?/g);
  return matches ? matches.length : 0;
}

/**
 * Extract imperative verbs from text
 * @param {string} text - Input text
 * @returns {string[]} Found imperative verbs
 */
export function extractImperativeVerbs(text) {
  if (!text) return [];
  const pattern = /\b(read|write|create|delete|run|execute|find|search|check|update|fix|add|remove|show|list|get|set|make|build|test|deploy|send|open|close|start|stop|install|configure|edit|copy|move|download|upload|generate|analyze|parse|format|validate|convert|extract|merge|split)\b/gi;
  const matches = text.match(pattern);
  if (!matches) return [];
  // Return unique, lowercase
  return [...new Set(matches.map(m => m.toLowerCase()))];
}

/**
 * Extract keywords from text (after stop word removal)
 * @param {string} text - Input text
 * @returns {string[]} Keywords
 */
export function extractKeywords(text) {
  if (!text) return [];
  
  // Lowercase, remove punctuation except hyphens
  const cleaned = text.toLowerCase().replace(/[^\w\s-]/g, ' ');
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  
  // Remove stop words
  return words.filter(w => !STOP_WORDS.has(w));
}

/**
 * @typedef {Object} TopicKeyword
 * @property {string} word - Keyword
 * @property {number} weight - TF weight
 */

/**
 * Create topic signature (frequency-weighted keywords)
 * @param {string} text - Input text
 * @returns {TopicKeyword[]} Top 10 keywords by frequency
 */
export function createTopicSignature(text) {
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return [];
  
  // Count frequencies
  const freq = {};
  keywords.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  
  // Return top 10 by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      weight: count / keywords.length
    }));
}

/**
 * Compute topic overlap between two signatures using Jaccard + TF
 * @param {TopicKeyword[]} sig1 - First signature
 * @param {TopicKeyword[]} sig2 - Second signature
 * @returns {number} Overlap score 0-1
 */
export function computeTopicOverlap(sig1, sig2) {
  if (!sig1 || !sig2 || sig1.length === 0 || sig2.length === 0) {
    return 0.5; // Default for missing data
  }
  
  const words1 = new Set(sig1.map(s => s.word));
  const words2 = new Set(sig2.map(s => s.word));
  
  // Find intersection
  const intersection = [...words1].filter(w => words2.has(w));
  
  // Union size
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0.5;
  
  // Jaccard similarity
  const jaccard = intersection.length / union.size;
  
  // Weighted overlap (consider TF weights)
  const weightMap1 = Object.fromEntries(sig1.map(s => [s.word, s.weight]));
  const weightMap2 = Object.fromEntries(sig2.map(s => [s.word, s.weight]));
  
  const weightedOverlap = intersection.length > 0
    ? intersection.reduce((sum, w) => {
        return sum + (weightMap1[w] || 0) + (weightMap2[w] || 0);
      }, 0) / 2
    : 0;
  
  // Blend: 60% Jaccard, 40% weighted
  return clamp(jaccard * 0.6 + weightedOverlap * 0.4, 0, 1);
}

/**
 * Compute thinking intensity from thinking blocks
 * @param {{text: string, length: number}[]} thinkingBlocks - Thinking blocks
 * @returns {number} Intensity 0-1
 */
export function computeThinkingIntensity(thinkingBlocks) {
  if (!thinkingBlocks || thinkingBlocks.length === 0) return 0;
  
  const totalChars = thinkingBlocks.reduce((sum, block) => sum + block.length, 0);
  
  // Scale: 2000+ chars = intensity 1.0
  return clamp(totalChars / 2000, 0, 1);
}

/**
 * Get latency bucket from milliseconds
 * @param {number} latencyMs - Latency in milliseconds
 * @returns {string} Bucket: fast, moderate, slow, extended
 */
export function getLatencyBucket(latencyMs) {
  const seconds = latencyMs / 1000;
  if (seconds < 5) return 'fast';
  if (seconds < 30) return 'moderate';
  if (seconds < 120) return 'slow';
  return 'extended';
}

/**
 * Calculate tool diversity score
 * @param {{name: string}[]} toolCalls - Tool calls
 * @returns {{count: number, uniqueTools: string[], categories: string[], diversityScore: number}}
 */
export function calculateToolDiversity(toolCalls) {
  if (!toolCalls || toolCalls.length === 0) {
    return {
      count: 0,
      uniqueTools: [],
      categories: [],
      diversityScore: 0
    };
  }
  
  const uniqueTools = [...new Set(toolCalls.map(t => t.name))];
  const categories = [...new Set(
    uniqueTools.map(name => TOOL_CATEGORIES[name] || 'other')
  )];
  
  // Max 7 categories
  const diversityScore = clamp(categories.length / 7, 0, 1);
  
  return {
    count: toolCalls.length,
    uniqueTools,
    categories,
    diversityScore
  };
}

/**
 * Compute focus score (0 = scattered, 1 = focused)
 * Based on metrics-spec.md formula
 * @param {Object} data - Prompt and response data
 * @param {number} data.charCount - Character count
 * @param {number} data.sentenceCount - Sentence count
 * @param {number} data.questionCount - Question count
 * @param {number} data.toolDiversity - Tool diversity (unique types / 5)
 * @param {number} data.topicOverlap - Topic overlap with previous (0-1)
 * @returns {number} Focus score 0-1
 */
export function computeFocusScore({ 
  charCount, 
  sentenceCount, 
  questionCount, 
  toolDiversity, 
  topicOverlap 
}) {
  const weights = {
    length: 0.20,
    sentenceCount: 0.15,
    questionCount: 0.15,
    toolDiversity: 0.20,
    topicCohesion: 0.30
  };
  
  const scores = {
    // Shorter = more focused
    length: clamp(1 - (charCount / 2000), 0, 1),
    // Fewer sentences = more focused  
    sentenceCount: clamp(1 - (sentenceCount - 1) / 10, 0, 1),
    // Single question = focused
    questionCount: clamp(1 - (questionCount - 1) / 5, 0, 1),
    // Fewer tool types = focused
    toolDiversity: clamp(1 - toolDiversity, 0, 1),
    // High overlap = focused
    topicCohesion: topicOverlap ?? 0.5
  };
  
  // Weighted sum
  const focusScore = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (scores[key] || 0) * weight,
    0
  );
  
  return clamp(focusScore, 0, 1);
}

/**
 * Calculate complexity score (0-100)
 * Based on SPEC.md formula
 * @param {Object} metrics - Partial metrics
 * @param {number} metrics.charCount - Character count
 * @param {number} metrics.toolCallCount - Number of tool calls
 * @param {number} metrics.responseLatencyMs - Response latency in ms
 * @returns {number} Complexity score 0-100
 */
export function calculateComplexity({ charCount, toolCallCount, responseLatencyMs }) {
  // Normalize each factor to 0-1 range
  const lengthFactor = clamp(charCount / 2000, 0, 1);
  const toolFactor = clamp(toolCallCount / 5, 0, 1);
  const latencyFactor = clamp(responseLatencyMs / 30000, 0, 1);
  
  // Weighted combination
  const raw = (lengthFactor * 0.4) + (toolFactor * 0.35) + (latencyFactor * 0.25);
  
  return Math.round(clamp(raw * 100, 0, 100));
}

/**
 * Intent types for prompt classification.
 * Drives node wireframe color in the visualizer.
 * @type {Object<string, {label: string, color: number}>}
 */
export const INTENT_TYPES = {
  question:      { label: 'Question',      color: 0x7DDFFF },  // Soft blue — seeking
  command:       { label: 'Command',       color: 0x00FFCC },  // Cyan-green — directive
  clarification: { label: 'Clarification', color: 0xAA44FF },  // Purple — refining
  creative:      { label: 'Creative',      color: 0xFFD085 },  // Amber — exploratory
  error:         { label: 'Error/Fix',     color: 0xFF5A5A },  // Red — something broke
  informational: { label: 'Informational', color: 0x84FFD1 },  // Soft green — sharing context
};

/**
 * Classify prompt intent from text content.
 * Uses heuristics — doesn't need to be perfect, just directionally right.
 *
 * @param {string} text - Prompt text
 * @param {number} questionCount - Number of question marks
 * @param {string[]} imperativeVerbs - Imperative verbs found
 * @returns {string} Intent key from INTENT_TYPES
 */
export function classifyIntent(text, questionCount, imperativeVerbs) {
  if (!text) return 'command';

  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Error/fix signals — check first, these are high-signal
  const errorPatterns = /\b(error|bug|fix|broke|broken|crash|fail|issue|wrong|doesn'?t work|not working|exception|stack ?trace|traceback)\b/i;
  if (errorPatterns.test(text)) {
    return 'error';
  }

  // Clarification signals — short follow-ups that refine a prior turn
  const clarificationPatterns = /\b(actually|instead|i meant|rather|what i mean|no,? |wait|sorry|correction|let me clarify|not that|the other)\b/i;
  if (clarificationPatterns.test(text) && wordCount < 40) {
    return 'clarification';
  }

  // Question-dominant
  if (questionCount >= 2 || (questionCount >= 1 && wordCount < 25)) {
    // Check if it's "how do I" / "what is" style vs "can you do X?" style
    const pureQuestion = /^(what|how|why|when|where|who|which|is |are |does |do |can |could |would |should )/i;
    if (pureQuestion.test(text.trim())) {
      return 'question';
    }
    // "Can you X?" is still a command disguised as a question
    if (/^can you /i.test(text.trim())) {
      return 'command';
    }
    return 'question';
  }

  // Creative / open-ended signals
  const creativePatterns = /\b(write|create|generate|imagine|story|poem|haiku|creative|brainstorm|suggest|ideas? for|come up with)\b/i;
  if (creativePatterns.test(text) && !errorPatterns.test(text)) {
    return 'creative';
  }

  // Informational — sharing context without a clear ask
  const informationalPatterns = /\b(here'?s|fyi|for context|note that|i should mention|background|context:)\b/i;
  if (informationalPatterns.test(text) && questionCount === 0 && imperativeVerbs.length === 0) {
    return 'informational';
  }

  // Command — has imperative verbs or is short and directive
  if (imperativeVerbs.length > 0) {
    return 'command';
  }

  // Default: if it has a question mark anywhere, question; otherwise command
  if (questionCount > 0) return 'question';
  return 'command';
}

/**
 * Content attachment types that can appear in a prompt.
 * Each type gets a distinct satellite shape in the visualizer.
 */
export const CONTENT_TYPES = {
  image:     { label: 'Image',     shape: 'sphere',     color: 0xFFAA55 },
  link:      { label: 'Link',      shape: 'diamond',    color: 0x22D3EE },
  codeBlock: { label: 'Code',      shape: 'prism',      color: 0x10B981 },
  fileRef:   { label: 'File',      shape: 'disc',       color: 0xF5A623 },
};

/**
 * Detect content attachments/embeds in prompt text.
 *
 * @param {string} text - Prompt text
 * @param {import('../data/parser.js').ContentBlock[]} [contentBlocks] - Raw content blocks from JSONL
 * @returns {{type: string, count: number}[]} Detected content types with counts
 */
export function detectContentTypes(text, contentBlocks) {
  const results = [];

  // --- Images ---
  let imageCount = 0;
  // Check content blocks for image type
  if (contentBlocks) {
    imageCount += contentBlocks.filter(b => b.type === 'image').length;
  }
  // Check text for image references
  const imagePatterns = /\.(png|jpg|jpeg|gif|svg|webp|bmp)\b/gi;
  const imageTextMatches = text?.match(imagePatterns);
  if (imageTextMatches) imageCount += imageTextMatches.length;
  if (imageCount > 0) results.push({ type: 'image', count: imageCount });

  // --- Links ---
  const linkPattern = /https?:\/\/[^\s)>\]]+/g;
  const linkMatches = text?.match(linkPattern);
  if (linkMatches && linkMatches.length > 0) {
    results.push({ type: 'link', count: linkMatches.length });
  }

  // --- Code blocks ---
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeMatches = text?.match(codeBlockPattern);
  // Also count inline code that's substantial (>20 chars)
  const inlineCodePattern = /`[^`]{20,}`/g;
  const inlineMatches = text?.match(inlineCodePattern);
  const totalCode = (codeMatches?.length || 0) + (inlineMatches?.length || 0);
  if (totalCode > 0) results.push({ type: 'codeBlock', count: totalCode });

  // --- File references ---
  const fileRefPattern = /\b[\w\-./]+\.(js|ts|py|rs|go|java|cpp|c|h|css|html|json|yaml|yml|toml|md|txt|sh|sql|rb|php|swift|kt)\b/g;
  const fileMatches = text?.match(fileRefPattern);
  if (fileMatches && fileMatches.length > 0) {
    // Deduplicate
    const unique = [...new Set(fileMatches)];
    results.push({ type: 'fileRef', count: unique.length });
  }

  return results;
}

/**
 * @typedef {Object} PromptMetrics
 * @property {number} charCount
 * @property {number} wordCount
 * @property {number} tokenEstimate
 * @property {number} toolCallCount
 * @property {string[]} toolTypes
 * @property {string[]} toolCategories
 * @property {number} responseLatencyMs
 * @property {string} latencyBucket
 * @property {number|null} similarityToPrev
 * @property {number|null} topicDriftScore
 * @property {number} complexityScore
 * @property {number} focusScore
 * @property {number} sentenceCount
 * @property {number} questionCount
 * @property {number} thinkingIntensity
 * @property {number} toolDiversity
 * @property {string} intent - Prompt intent classification (question, command, etc.)
 * @property {{type: string, count: number}[]} contentTypes - Detected content attachments
 */

/**
 * Calculate all metrics for a prompt node
 * @param {string} text - Prompt text
 * @param {number} responseLatencyMs - Response latency in ms
 * @param {{name: string}[]} toolCalls - Tool calls from response
 * @param {{text: string, length: number}[]} thinkingBlocks - Thinking blocks from response
 * @param {number} topicOverlap - Topic overlap with previous prompt (0-1)
 * @param {import('../data/parser.js').ContentBlock[]} [contentBlocks] - Raw content blocks
 * @returns {PromptMetrics} All computed metrics
 */
export function calculateMetrics(text, responseLatencyMs, toolCalls, thinkingBlocks, topicOverlap, contentBlocks) {
  // Basic text metrics
  const charCount = text?.length || 0;
  const wordCount = countWords(text);
  const tokenEstimate = estimateTokens(text);
  const sentenceCount = countSentences(text);
  const questionCount = countQuestions(text);

  // Tool metrics
  const { count: toolCallCount, uniqueTools: toolTypes, categories: toolCategories, diversityScore: toolDiversity } = calculateToolDiversity(toolCalls);

  // Thinking intensity
  const thinkingIntensity = computeThinkingIntensity(thinkingBlocks);

  // Latency
  const latencyBucket = getLatencyBucket(responseLatencyMs);

  // Topic metrics
  const similarityToPrev = topicOverlap;
  const topicDriftScore = topicOverlap !== null ? 1 - topicOverlap : null;

  // Focus score
  const focusScore = computeFocusScore({
    charCount,
    sentenceCount,
    questionCount,
    toolDiversity,
    topicOverlap
  });

  // Complexity score
  const complexityScore = calculateComplexity({
    charCount,
    toolCallCount,
    responseLatencyMs
  });

  // Intent classification
  const imperativeVerbs = extractImperativeVerbs(text);
  const intent = classifyIntent(text, questionCount, imperativeVerbs);

  // Content type detection
  const contentTypes = detectContentTypes(text, contentBlocks);

  return {
    charCount,
    wordCount,
    tokenEstimate,
    toolCallCount,
    toolTypes,
    toolCategories,
    responseLatencyMs,
    latencyBucket,
    similarityToPrev,
    topicDriftScore,
    complexityScore,
    focusScore: Math.round(focusScore * 100) / 100,
    sentenceCount,
    questionCount,
    thinkingIntensity: Math.round(thinkingIntensity * 100) / 100,
    toolDiversity: Math.round(toolDiversity * 100) / 100,
    intent,
    contentTypes,
  };
}

export default {
  estimateTokens,
  countWords,
  countSentences,
  countQuestions,
  extractKeywords,
  extractImperativeVerbs,
  createTopicSignature,
  computeTopicOverlap,
  computeFocusScore,
  calculateComplexity,
  calculateMetrics,
  calculateToolDiversity,
  getLatencyBucket,
  computeThinkingIntensity,
  classifyIntent,
  detectContentTypes,
  INTENT_TYPES,
  CONTENT_TYPES,
};
