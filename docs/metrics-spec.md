# Metrics Specification — Prompt Quant Visualizer

> **Author:** PQV-PromptAnalyst  
> **Date:** 2026-02-11  
> **Status:** Ready for implementation

---

## 1. Data Source & Structure

### 1.1 Session Files
- **Location:** `~/.openclaw/agents/main/sessions/*.jsonl`
- **Format:** Newline-delimited JSON (JSONL)
- **Key entry types:**
  - `type: "session_start"` — Session metadata
  - `type: "message"` with `message.role: "user"` — **Prompt nodes**
  - `type: "message"` with `message.role: "assistant"` — Response data
  - `type: "message"` with `message.role: "toolResult"` — Tool execution results

### 1.2 Prompt Node Extraction
Each user message becomes a visualization node. Extract from entries where:
```javascript
entry.type === "message" && entry.message.role === "user"
```

**Fields per prompt:**
```typescript
interface RawPrompt {
  id: string;                    // entry.id
  parentId: string | null;       // entry.parentId (for threading)
  timestamp: string;             // entry.timestamp (ISO-8601)
  text: string;                  // entry.message.content[0].text
}
```

---

## 2. Focus vs. Scatter — The Core Thesis

A prompt's "vector character" describes how *directional* versus *diffuse* a user's intent is. This maps to visual density in the starmap.

### 2.1 Focused Prompts (Tight Vector)
**Characteristics:**
- Single, clear objective
- Short-to-medium length (50-500 chars)
- Few or no topic switches within the prompt
- Often a direct follow-up to previous context
- Results in targeted tool usage (0-2 tools)

**Heuristics:**
```javascript
isFocused(prompt) {
  return (
    prompt.charCount < 500 &&
    prompt.sentenceCount <= 3 &&
    prompt.questionCount <= 1 &&
    prompt.topicKeywords.length <= 3 &&
    prompt.imperativeVerbs.length <= 2
  );
}
```

### 2.2 Scattered Prompts (Starburst Vector)
**Characteristics:**
- Multiple unrelated requests in one message
- Long, rambling structure (>800 chars)
- Multiple questions or commands
- Topic jumps within single prompt
- Results in diverse tool usage (3+ tools of different types)

**Heuristics:**
```javascript
isScattered(prompt) {
  return (
    prompt.charCount > 800 ||
    prompt.sentenceCount > 5 ||
    prompt.questionCount > 2 ||
    prompt.topicKeywords.length > 6 ||
    prompt.imperativeVerbs.length > 3
  );
}
```

### 2.3 Focus Score (0.0 → 1.0)
Composite score where **1.0 = laser focused**, **0.0 = maximally scattered**.

```javascript
function computeFocusScore(prompt, response) {
  const weights = {
    length: 0.20,        // Shorter = more focused
    sentenceCount: 0.15, // Fewer sentences = more focused
    questionCount: 0.15, // Single question = focused
    toolDiversity: 0.20, // Fewer tool types = focused
    topicCohesion: 0.30  // High keyword overlap with prev = focused
  };
  
  const scores = {
    length: clamp(1 - (prompt.charCount / 2000), 0, 1),
    sentenceCount: clamp(1 - (prompt.sentenceCount - 1) / 10, 0, 1),
    questionCount: clamp(1 - (prompt.questionCount - 1) / 5, 0, 1),
    toolDiversity: clamp(1 - (response.uniqueToolTypes / 5), 0, 1),
    topicCohesion: prompt.topicOverlapWithPrevious ?? 0.5
  };
  
  return Object.entries(weights).reduce(
    (sum, [k, w]) => sum + scores[k] * w, 0
  );
}
```

---

## 3. Complexity Metrics

### 3.1 Token Count (Estimated)
Since we don't have a tokenizer, estimate using char-based heuristic:
```javascript
estimateTokens(text) {
  // GPT-style: ~4 chars per token for English
  return Math.ceil(text.length / 4);
}
```

**Visual weight:** Primary driver of node radius.

### 3.2 Tool Call Metrics
Extract from assistant responses following the prompt:

```javascript
function extractToolMetrics(assistantMessages) {
  const toolCalls = assistantMessages.flatMap(msg =>
    msg.content.filter(c => c.type === "toolCall")
  );
  
  return {
    totalCalls: toolCalls.length,
    uniqueTools: new Set(toolCalls.map(t => t.toolName)).size,
    toolTypes: categorizeTools(toolCalls), // See 3.3
    toolNames: toolCalls.map(t => t.toolName)
  };
}
```

### 3.3 Tool Categories
Group tools into categories for diversity scoring:

| Category | Tools |
|----------|-------|
| `filesystem` | read, write, edit |
| `execution` | exec, process |
| `browser` | browser |
| `search` | web_search, web_fetch |
| `media` | image, tts |
| `communication` | message |
| `infrastructure` | nodes, canvas |

```javascript
const TOOL_CATEGORIES = {
  read: 'filesystem', write: 'filesystem', edit: 'filesystem',
  exec: 'execution', process: 'execution',
  browser: 'browser',
  web_search: 'search', web_fetch: 'search',
  image: 'media', tts: 'media',
  message: 'communication',
  nodes: 'infrastructure', canvas: 'infrastructure'
};
```

**Tool diversity score (0-1):** `uniqueCategories / 7`

### 3.4 Response Latency
Time from prompt timestamp to final assistant message timestamp:
```javascript
function computeLatency(promptEntry, finalResponseEntry) {
  const start = new Date(promptEntry.timestamp);
  const end = new Date(finalResponseEntry.timestamp);
  return (end - start) / 1000; // seconds
}
```

**Buckets for visualization:**
- `fast`: < 5s
- `moderate`: 5-30s
- `slow`: 30-120s
- `extended`: > 120s

### 3.5 Thinking Intensity
Presence and length of `type: "thinking"` blocks in assistant response:
```javascript
function computeThinkingIntensity(assistantMessages) {
  const thinkingBlocks = assistantMessages.flatMap(msg =>
    msg.content.filter(c => c.type === "thinking")
  );
  
  const totalThinkingChars = thinkingBlocks.reduce(
    (sum, t) => sum + (t.thinking?.length || 0), 0
  );
  
  return {
    hasThinking: thinkingBlocks.length > 0,
    thinkingBlocks: thinkingBlocks.length,
    thinkingChars: totalThinkingChars,
    thinkingIntensity: Math.min(totalThinkingChars / 2000, 1) // 0-1 scale
  };
}
```

---

## 4. Topic Drift Detection

### 4.1 Keyword Extraction (MVP Approach)
No external APIs. Use regex-based extraction:

```javascript
function extractKeywords(text) {
  // Lowercase, remove punctuation
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Split into words
  const words = cleaned.split(/\s+/).filter(w => w.length > 3);
  
  // Remove common stop words
  const STOP_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
    'their', 'what', 'when', 'where', 'which', 'while', 'would',
    'could', 'should', 'about', 'after', 'before', 'being', 'between',
    'both', 'each', 'into', 'just', 'more', 'most', 'other', 'over',
    'same', 'some', 'such', 'than', 'then', 'these', 'through',
    'under', 'very', 'will', 'your', 'also', 'back', 'because',
    'come', 'does', 'down', 'even', 'first', 'good', 'great', 'here',
    'know', 'like', 'look', 'make', 'much', 'need', 'only', 'part',
    'people', 'place', 'right', 'take', 'think', 'want', 'well', 'work'
  ]);
  
  return words.filter(w => !STOP_WORDS.has(w));
}
```

### 4.2 Topic Signature
Create a frequency-weighted set of keywords per prompt:

```javascript
function createTopicSignature(text) {
  const keywords = extractKeywords(text);
  const freq = {};
  keywords.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  // Return top 10 by frequency
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, weight: count / keywords.length }));
}
```

### 4.3 Topic Overlap Score (Jaccard + TF)
Compare consecutive prompts:

```javascript
function computeTopicOverlap(sig1, sig2) {
  if (!sig1 || !sig2) return 0.5; // Default for first prompt
  
  const words1 = new Set(sig1.map(s => s.word));
  const words2 = new Set(sig2.map(s => s.word));
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  // Jaccard similarity
  const jaccard = intersection.length / union.size;
  
  // Weighted overlap (consider TF weights)
  const weightMap1 = Object.fromEntries(sig1.map(s => [s.word, s.weight]));
  const weightMap2 = Object.fromEntries(sig2.map(s => [s.word, s.weight]));
  
  const weightedOverlap = intersection.reduce((sum, w) => {
    return sum + (weightMap1[w] || 0) + (weightMap2[w] || 0);
  }, 0) / 2;
  
  // Blend: 60% Jaccard, 40% weighted
  return jaccard * 0.6 + weightedOverlap * 0.4;
}
```

### 4.4 Drift Categories

| Overlap Score | Category | Visual Indicator |
|---------------|----------|------------------|
| 0.8 - 1.0 | `continuation` | Strong connection line |
| 0.5 - 0.8 | `related` | Medium connection line |
| 0.2 - 0.5 | `tangent` | Thin connection line |
| 0.0 - 0.2 | `new_topic` | Dashed/faint line |

---

## 5. Satellite Mapping

Each node can have **up to 6 satellites** orbiting it, representing different metrics. Satellites are small geometric shapes positioned around the parent node.

### 5.1 Satellite Definitions

| Satellite | Shape | Metric | Scale |
|-----------|-------|--------|-------|
| **Token Mass** | Sphere | Estimated token count | 50-2000 tokens |
| **Tool Burst** | Cube | Total tool calls | 0-20 calls |
| **Tool Diversity** | Octahedron | Unique tool categories | 0-7 categories |
| **Response Time** | Cone | Latency bucket | 4 discrete levels |
| **Thinking Depth** | Torus | Thinking intensity | 0-1 continuous |
| **Focus Beam** | Cylinder | Focus score | 0-1 continuous |

### 5.2 Satellite Size Formula
Each satellite scales relative to its metric:

```javascript
function computeSatelliteSize(metric, config) {
  const { min, max, minSize, maxSize } = config;
  const normalized = clamp((metric - min) / (max - min), 0, 1);
  return minSize + normalized * (maxSize - minSize);
}

const SATELLITE_CONFIGS = {
  tokenMass: { min: 50, max: 2000, minSize: 0.1, maxSize: 0.5 },
  toolBurst: { min: 0, max: 20, minSize: 0.05, maxSize: 0.4 },
  toolDiversity: { min: 0, max: 7, minSize: 0.05, maxSize: 0.35 },
  responseTime: { min: 0, max: 3, minSize: 0.1, maxSize: 0.3 }, // bucket index
  thinkingDepth: { min: 0, max: 1, minSize: 0.05, maxSize: 0.3 },
  focusBeam: { min: 0, max: 1, minSize: 0.1, maxSize: 0.4 }
};
```

### 5.3 Satellite Positioning
Satellites orbit at fixed angular offsets, distance based on parent node size:

```javascript
function positionSatellites(nodeRadius, activeSatellites) {
  const orbitRadius = nodeRadius * 1.8;
  const angleStep = (2 * Math.PI) / 6; // Max 6 satellites
  
  return activeSatellites.map((sat, i) => ({
    ...sat,
    x: Math.cos(i * angleStep) * orbitRadius,
    y: Math.sin(i * angleStep) * orbitRadius,
    z: 0 // Flat orbit plane
  }));
}
```

---

## 6. Node Sizing & Positioning

### 6.1 Node Radius
Primary size determined by **complexity composite**:

```javascript
function computeNodeRadius(metrics) {
  const BASE_RADIUS = 0.3;
  const MAX_RADIUS = 1.5;
  
  // Weighted complexity
  const complexity = (
    (metrics.tokenCount / 500) * 0.35 +
    (metrics.toolCalls / 10) * 0.30 +
    (1 - metrics.focusScore) * 0.20 + // Scattered = bigger
    (metrics.thinkingIntensity) * 0.15
  );
  
  return BASE_RADIUS + clamp(complexity, 0, 1) * (MAX_RADIUS - BASE_RADIUS);
}
```

### 6.2 Node Shape Selection
Shape indicates **prompt type**:

| Shape | Prompt Characteristics |
|-------|------------------------|
| **Sphere** | General query/instruction |
| **Cube** | Configuration/setup task |
| **Octahedron** | Multi-part request |
| **Tetrahedron** | Quick follow-up (< 100 chars) |
| **Dodecahedron** | Complex multi-tool operation |

```javascript
function selectNodeShape(metrics) {
  if (metrics.charCount < 100 && metrics.topicOverlap > 0.7)
    return 'tetrahedron'; // Quick follow-up
  if (metrics.toolDiversity >= 4)
    return 'dodecahedron'; // Multi-tool complex
  if (metrics.questionCount >= 3 || metrics.imperativeVerbs >= 3)
    return 'octahedron'; // Multi-part
  if (metrics.isSystemConfig)
    return 'cube'; // Config task
  return 'sphere'; // Default
}
```

### 6.3 Positioning Algorithm
Nodes are positioned in a **temporal spiral** with topic clustering:

```javascript
function computeNodePosition(node, index, allNodes) {
  // Base: Archimedean spiral (time progression)
  const t = index / allNodes.length;
  const spiralRadius = 2 + t * 15; // Expand outward
  const spiralAngle = t * 6 * Math.PI; // ~3 rotations
  
  const baseX = Math.cos(spiralAngle) * spiralRadius;
  const baseY = Math.sin(spiralAngle) * spiralRadius;
  const baseZ = t * 3; // Slight Z lift over time
  
  // Topic clustering offset
  const topicCluster = computeTopicClusterOffset(node, allNodes);
  
  return {
    x: baseX + topicCluster.x,
    y: baseY + topicCluster.y,
    z: baseZ + topicCluster.z
  };
}

function computeTopicClusterOffset(node, allNodes) {
  // Find nodes with high topic overlap
  const related = allNodes.filter(n =>
    n.id !== node.id &&
    computeTopicOverlap(n.topicSignature, node.topicSignature) > 0.6
  );
  
  if (related.length === 0) return { x: 0, y: 0, z: 0 };
  
  // Gentle attraction toward cluster centroid
  const centroid = {
    x: related.reduce((s, n) => s + n.position.x, 0) / related.length,
    y: related.reduce((s, n) => s + n.position.y, 0) / related.length,
    z: related.reduce((s, n) => s + n.position.z, 0) / related.length
  };
  
  const pullStrength = 0.3;
  return {
    x: (centroid.x - node.basePosition.x) * pullStrength,
    y: (centroid.y - node.basePosition.y) * pullStrength,
    z: (centroid.z - node.basePosition.z) * pullStrength
  };
}
```

---

## 7. Edge/Path Properties

### 7.1 Connection Types
Edges connect consecutive prompts (by timestamp or parent-child relationship):

```javascript
function createEdges(nodes) {
  const edges = [];
  
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const curr = nodes[i];
    
    edges.push({
      source: prev.id,
      target: curr.id,
      topicOverlap: computeTopicOverlap(prev.topicSignature, curr.topicSignature),
      timeDelta: (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000,
      type: classifyEdgeType(prev, curr)
    });
  }
  
  return edges;
}
```

### 7.2 Edge Visual Properties

| Property | Driver | Visual Effect |
|----------|--------|---------------|
| **Opacity** | Topic overlap | 0.2 (drift) → 1.0 (continuation) |
| **Thickness** | Inverse time delta | Thin if long gap, thick if rapid-fire |
| **Color** | Edge type | Cyan (flow), Purple (drift), Orange (return) |
| **Style** | Topic drift category | Solid / Dashed / Dotted |

```javascript
function computeEdgeStyle(edge) {
  return {
    opacity: 0.2 + edge.topicOverlap * 0.8,
    thickness: clamp(1 - (edge.timeDelta / 300), 0.3, 1.0) * 2, // Max 2px
    color: edge.type === 'continuation' ? '#00ffff' :
           edge.type === 'drift' ? '#aa00ff' :
           edge.type === 'return' ? '#ff8800' : '#ffffff',
    dashArray: edge.topicOverlap < 0.2 ? [5, 5] :
               edge.topicOverlap < 0.5 ? [10, 5] : null
  };
}
```

### 7.3 Edge Type Classification

```javascript
function classifyEdgeType(prev, curr) {
  const overlap = computeTopicOverlap(prev.topicSignature, curr.topicSignature);
  const timeDelta = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
  
  if (overlap > 0.7) return 'continuation';
  if (overlap < 0.2 && timeDelta > 300) return 'new_topic';
  if (overlap < 0.3) return 'drift';
  
  // Check if returning to an older topic
  // (Would require looking back further in history)
  return 'related';
}
```

---

## 8. Visual State Thresholds

### 8.1 Node States

| State | Criteria | Visual Treatment |
|-------|----------|------------------|
| **Nominal** | focusScore > 0.6, toolCalls < 5 | Base glow, standard wireframe |
| **Warning** | 0.3 < focusScore ≤ 0.6 OR 5 ≤ toolCalls < 10 | Amber tint, pulse animation |
| **Complex** | focusScore ≤ 0.3 OR toolCalls ≥ 10 | Red tint, intense glow, larger satellites |

```javascript
function computeNodeState(metrics) {
  const { focusScore, toolCalls, thinkingIntensity } = metrics;
  
  if (focusScore <= 0.3 || toolCalls >= 10 || thinkingIntensity > 0.8)
    return 'complex';
  if (focusScore <= 0.6 || toolCalls >= 5 || thinkingIntensity > 0.5)
    return 'warning';
  return 'nominal';
}
```

### 8.2 State Color Mapping

```javascript
const STATE_COLORS = {
  nominal: {
    core: '#00ffff',      // Cyan
    glow: '#0088aa',
    wireframe: '#00cccc'
  },
  warning: {
    core: '#ffcc00',      // Amber
    glow: '#aa8800',
    wireframe: '#ddaa00'
  },
  complex: {
    core: '#ff4444',      // Red
    glow: '#aa2222',
    wireframe: '#ff6666'
  }
};
```

### 8.3 Animation Intensity

| State | Glow Intensity | Pulse Speed | Satellite Orbit Speed |
|-------|----------------|-------------|----------------------|
| Nominal | 1.0x | 0 (static) | 0.5 rad/s |
| Warning | 1.5x | 0.5 Hz | 1.0 rad/s |
| Complex | 2.0x | 1.0 Hz | 2.0 rad/s |

---

## 9. Complete Node Data Structure

Final computed structure per prompt node:

```typescript
interface PromptNode {
  // Identity
  id: string;
  index: number;
  timestamp: Date;
  text: string;
  
  // Raw metrics
  charCount: number;
  estimatedTokens: number;
  sentenceCount: number;
  questionCount: number;
  imperativeVerbs: string[];
  topicSignature: TopicKeyword[];
  
  // Response metrics (from following assistant messages)
  toolCalls: number;
  toolNames: string[];
  toolCategories: string[];
  toolDiversity: number;
  latencySeconds: number;
  latencyBucket: 'fast' | 'moderate' | 'slow' | 'extended';
  thinkingIntensity: number;
  
  // Computed scores
  focusScore: number;
  topicOverlapWithPrevious: number;
  
  // Visual properties
  state: 'nominal' | 'warning' | 'complex';
  shape: string;
  radius: number;
  position: { x: number; y: number; z: number };
  satellites: Satellite[];
  color: { core: string; glow: string; wireframe: string };
}

interface Satellite {
  type: string;
  shape: string;
  size: number;
  position: { x: number; y: number; z: number };
  value: number;
  label: string;
}

interface Edge {
  source: string;
  target: string;
  topicOverlap: number;
  timeDelta: number;
  type: 'continuation' | 'related' | 'drift' | 'new_topic' | 'return';
  style: {
    opacity: number;
    thickness: number;
    color: string;
    dashArray: number[] | null;
  };
}
```

---

## 10. Implementation Checklist

### Phase 1: Data Parser
- [ ] Read JSONL session files
- [ ] Extract user messages as prompt nodes
- [ ] Link responses to prompts by parentId chain
- [ ] Extract tool calls from assistant messages

### Phase 2: Metric Calculators
- [ ] Token estimation function
- [ ] Sentence/question counting (regex-based)
- [ ] Keyword extraction with stop words
- [ ] Topic signature generation
- [ ] Topic overlap scoring
- [ ] Focus score computation
- [ ] Tool diversity scoring

### Phase 3: Visual Mapping
- [ ] Node radius calculation
- [ ] Node shape selection
- [ ] Satellite generation and sizing
- [ ] Position calculation (spiral + clustering)
- [ ] Edge generation with styles
- [ ] State classification

### Phase 4: Integration
- [ ] Export as JSON for Three.js consumption
- [ ] Real-time update hooks for live sessions

---

## Appendix A: Regex Patterns

```javascript
// Sentence detection
const SENTENCE_REGEX = /[.!?]+\s+|[.!?]+$/g;

// Question detection  
const QUESTION_REGEX = /\?/g;

// Imperative verb detection (common command verbs)
const IMPERATIVE_REGEX = /\b(read|write|create|delete|run|execute|find|search|check|update|fix|add|remove|show|list|get|set|make|build|test|deploy|send|open|close|start|stop)\b/gi;

// System prompt detection
const SYSTEM_PROMPT_REGEX = /^(System:|Reminder|Heartbeat|HEARTBEAT)/i;
```

---

## Appendix B: Sample Output

```json
{
  "nodes": [
    {
      "id": "abc123",
      "index": 0,
      "timestamp": "2026-02-11T00:30:00.000Z",
      "text": "Check my email for anything urgent",
      "charCount": 34,
      "estimatedTokens": 9,
      "focusScore": 0.85,
      "toolCalls": 1,
      "toolDiversity": 0.14,
      "state": "nominal",
      "shape": "sphere",
      "radius": 0.35,
      "position": { "x": 2.0, "y": 0.5, "z": 0.1 },
      "satellites": [
        { "type": "tokenMass", "shape": "sphere", "size": 0.12 },
        { "type": "focusBeam", "shape": "cylinder", "size": 0.34 }
      ]
    }
  ],
  "edges": [
    {
      "source": "abc123",
      "target": "def456",
      "topicOverlap": 0.72,
      "type": "continuation",
      "style": { "opacity": 0.78, "thickness": 1.5, "color": "#00ffff" }
    }
  ]
}
```

---

*Specification complete. Ready for Data Engineer and Viz Engineer handoff.*
