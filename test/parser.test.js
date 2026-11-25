import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSessionFromString } from '../src/data/parser.js';

test('parses OpenClaw session entries into linked prompt nodes', () => {
  const jsonl = [
    JSON.stringify({ type: 'session', id: 's1', timestamp: '2026-01-01T00:00:00.000Z' }),
    JSON.stringify({
      type: 'message',
      id: 'u1',
      timestamp: '2026-01-01T00:00:01.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'Sort this list in Python.' }] },
    }),
    JSON.stringify({
      type: 'message',
      id: 'a1',
      timestamp: '2026-01-01T00:00:02.500Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Use a stable tuple key for the sort.' },
          { type: 'toolCall', id: 't1', name: 'exec', arguments: {} },
          { type: 'text', text: 'Here is a function.' },
        ],
      },
    }),
    JSON.stringify({
      type: 'message',
      id: 'u2',
      timestamp: '2026-01-01T00:01:00.000Z',
      message: { role: 'user', content: [{ type: 'text', text: 'Now explain the function.' }] },
    }),
  ].join('\n');

  const result = parseSessionFromString(jsonl, 'fixture');

  assert.equal(result.success, true);
  assert.equal(result.meta.sessionId, 's1');
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].text, 'Sort this list in Python.');
  assert.equal(result.nodes[0].nextId, 'u2');
  assert.equal(result.nodes[1].prevId, 'u1');
  assert.equal(result.nodes[0].metrics.toolCallCount, 1);
  assert.equal(result.nodes[0].metrics.toolTypes[0], 'exec');
  assert.equal(result.nodes[0].metrics.responseLatencyMs, 1500);
  assert.ok(result.nodes[0].metrics.thinkingIntensity > 0);
  assert.equal(result.nodes[0].metrics.topicDriftScore === null, false);
});

test('parses simple role and content transcripts', () => {
  const jsonl = [
    '{"role":"user","content":"Hello there","timestamp":"2026-02-01T00:00:00.000Z"}',
    '{"role":"assistant","content":"Hi","timestamp":"2026-02-01T00:00:01.000Z"}',
    '{"role":"user","content":"Follow up question?","timestamp":"2026-02-01T00:00:20.000Z"}',
  ].join('\n');

  const result = parseSessionFromString(jsonl);

  assert.equal(result.success, true);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].metrics.responseLatencyMs, 1000);
  assert.equal(result.nodes[1].text, 'Follow up question?');
  assert.equal(result.nodes[0].id, 'line-1');
});

test('keeps valid prompts when a line is invalid JSON', () => {
  const result = parseSessionFromString('not-json\n{"role":"user","content":"Still here"}\n');

  assert.equal(result.success, true);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.nodes[0].text, 'Still here');
});

test('fails clearly when a file has no user prompts', () => {
  const result = parseSessionFromString('{"type":"session","id":"empty"}\n');

  assert.equal(result.success, false);
  assert.deepEqual(result.nodes, []);
  assert.equal(result.meta.nodeCount, 0);
});

test('demo session is a deployable transcript with varied metrics', async () => {
  const jsonl = await readFile(new URL('../public/demo-session.jsonl', import.meta.url), 'utf8');
  const result = parseSessionFromString(jsonl, 'fallback');

  assert.equal(result.success, true);
  assert.equal(result.meta.sessionId, 'demo');
  assert.equal(result.nodes.length, 12);
  assert.ok(result.nodes.some((node) => node.metrics.toolCallCount > 0));
  assert.ok(result.nodes.some((node) => node.metrics.thinkingIntensity > 0));
  assert.ok(result.nodes[0].metrics.responseLatencyMs > 0);
  assert.equal(result.errors.length, 0);
});
