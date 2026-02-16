/**
 * Outcome Link — Connects sessions to git repos and work outcomes
 * @module data/outcome-link
 *
 * The feedback loop: session shape only becomes useful when you can
 * correlate it with what actually got produced. A tight focused-build
 * session that ships a feature is different from a tight focused-build
 * session that produces nothing. This module provides the data structure
 * and helpers for that correlation.
 *
 * Data sources:
 * - Git repo metadata (branch, commits, files changed)
 * - ClawBot/OpenClaw memory chain tags
 * - User-provided outcome tags
 *
 * The link is stored alongside the session parse result so the visualizer
 * can display outcome context and, over time, build a dataset of
 * shape → outcome correlations.
 */

/**
 * @typedef {Object} OutcomeLink
 * @property {string} sessionId       - Session this outcome links to
 * @property {string|null} repo       - Git repo URL or local path
 * @property {string|null} branch     - Branch name worked on
 * @property {CommitRange|null} commitRange - First and last commit in session window
 * @property {DiffSummary|null} diff  - Aggregate diff stats for the session
 * @property {string} outcome         - Outcome classification
 * @property {string[]} tags          - User/system tags (e.g. 'feature', 'bugfix', 'refactor')
 * @property {string|null} memoryChainId - ClawBot memory chain reference
 * @property {number} linkedAt        - Timestamp when link was created
 */

/**
 * @typedef {Object} CommitRange
 * @property {string} first  - First commit hash in session window
 * @property {string} last   - Last commit hash in session window
 * @property {number} count  - Number of commits
 * @property {string[]} messages - Commit messages
 */

/**
 * @typedef {Object} DiffSummary
 * @property {number} filesChanged  - Number of files modified
 * @property {number} linesAdded    - Lines added
 * @property {number} linesRemoved  - Lines removed
 * @property {string[]} fileTypes   - Unique file extensions touched
 */

/**
 * Outcome classifications.
 * These can be set manually or inferred from git/memory chain data.
 */
export const OUTCOMES = {
  shipped:   { label: 'Shipped',   description: 'Feature/fix merged or deployed',    color: 0x00FFCC },
  wip:       { label: 'WIP',       description: 'Work in progress, not yet merged',  color: 0xFFD085 },
  abandoned: { label: 'Abandoned', description: 'Work was dropped or reverted',       color: 0xFF8080 },
  research:  { label: 'Research',  description: 'Investigation only, no code output', color: 0xAA44FF },
  unknown:   { label: 'Unknown',   description: 'Outcome not yet determined',         color: 0x8899AA },
};

/**
 * Create an empty OutcomeLink for a session.
 * @param {string} sessionId
 * @returns {OutcomeLink}
 */
export function createOutcomeLink(sessionId) {
  return {
    sessionId,
    repo: null,
    branch: null,
    commitRange: null,
    diff: null,
    outcome: 'unknown',
    tags: [],
    memoryChainId: null,
    linkedAt: Date.now(),
  };
}

/**
 * Link a session to a git repository.
 * This is the minimal link — just repo + branch.
 * Commit range and diff stats can be populated later from git data.
 *
 * @param {OutcomeLink} link - Existing outcome link
 * @param {Object} repoInfo
 * @param {string} repoInfo.repo - Repo URL or local path
 * @param {string} repoInfo.branch - Branch name
 * @param {string} [repoInfo.memoryChainId] - ClawBot memory chain ID
 * @returns {OutcomeLink} Updated link
 */
export function linkToRepo(link, { repo, branch, memoryChainId }) {
  return {
    ...link,
    repo,
    branch,
    memoryChainId: memoryChainId || link.memoryChainId,
    linkedAt: Date.now(),
  };
}

/**
 * Attach commit range data to an outcome link.
 * Typically populated from `git log --after=<session_start> --before=<session_end>`.
 *
 * @param {OutcomeLink} link
 * @param {CommitRange} commitRange
 * @returns {OutcomeLink}
 */
export function attachCommitRange(link, commitRange) {
  return {
    ...link,
    commitRange,
    linkedAt: Date.now(),
  };
}

/**
 * Attach diff summary to an outcome link.
 * Typically populated from `git diff --stat <first_commit>...<last_commit>`.
 *
 * @param {OutcomeLink} link
 * @param {DiffSummary} diff
 * @returns {OutcomeLink}
 */
export function attachDiffSummary(link, diff) {
  return {
    ...link,
    diff,
    linkedAt: Date.now(),
  };
}

/**
 * Set the outcome classification for a session.
 *
 * @param {OutcomeLink} link
 * @param {string} outcome - One of: shipped, wip, abandoned, research, unknown
 * @param {string[]} [tags] - Additional tags
 * @returns {OutcomeLink}
 */
export function setOutcome(link, outcome, tags) {
  return {
    ...link,
    outcome: OUTCOMES[outcome] ? outcome : 'unknown',
    tags: tags || link.tags,
    linkedAt: Date.now(),
  };
}

/**
 * Infer outcome from commit range data.
 * Simple heuristic: if there are commits and files changed, it's at least WIP.
 * This is intentionally conservative — real outcome tagging should be user-driven
 * or come from CI/merge status.
 *
 * @param {OutcomeLink} link
 * @returns {string} Inferred outcome
 */
export function inferOutcome(link) {
  if (!link.commitRange || link.commitRange.count === 0) {
    return 'research'; // No commits = research/exploration
  }

  if (link.diff && link.diff.filesChanged > 0) {
    return 'wip'; // Has changes but we can't know if they shipped
  }

  return 'unknown';
}

/**
 * Compute a simple "productivity score" from the outcome link.
 * This is a rough heuristic for visualization — NOT a judgment of quality.
 *
 * Score components:
 * - Commits produced (0-40 points)
 * - Files touched (0-30 points)
 * - Lines changed (0-30 points)
 *
 * @param {OutcomeLink} link
 * @returns {number} 0-100 score
 */
export function computeOutputScore(link) {
  let score = 0;

  if (link.commitRange) {
    score += Math.min(40, link.commitRange.count * 10);
  }

  if (link.diff) {
    score += Math.min(30, link.diff.filesChanged * 5);
    const totalLines = (link.diff.linesAdded || 0) + (link.diff.linesRemoved || 0);
    score += Math.min(30, totalLines / 10);
  }

  return Math.round(Math.min(100, score));
}

/**
 * Serialize an OutcomeLink for storage (localStorage, JSONL, etc).
 * @param {OutcomeLink} link
 * @returns {string} JSON string
 */
export function serializeLink(link) {
  return JSON.stringify(link);
}

/**
 * Deserialize an OutcomeLink from storage.
 * @param {string} json
 * @returns {OutcomeLink|null}
 */
export function deserializeLink(json) {
  try {
    const link = JSON.parse(json);
    // Validate required fields
    if (!link.sessionId) return null;
    return {
      sessionId: link.sessionId,
      repo: link.repo || null,
      branch: link.branch || null,
      commitRange: link.commitRange || null,
      diff: link.diff || null,
      outcome: link.outcome || 'unknown',
      tags: link.tags || [],
      memoryChainId: link.memoryChainId || null,
      linkedAt: link.linkedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Store an outcome link in localStorage.
 * Links are stored in a map keyed by sessionId.
 *
 * @param {OutcomeLink} link
 */
export function storeLink(link) {
  const STORAGE_KEY = 'pqv_outcome_links';
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    existing[link.sessionId] = link;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // localStorage unavailable or full — fail silently
  }
}

/**
 * Retrieve an outcome link from localStorage.
 *
 * @param {string} sessionId
 * @returns {OutcomeLink|null}
 */
export function retrieveLink(sessionId) {
  const STORAGE_KEY = 'pqv_outcome_links';
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return existing[sessionId] || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve all stored outcome links.
 * @returns {OutcomeLink[]}
 */
export function retrieveAllLinks() {
  const STORAGE_KEY = 'pqv_outcome_links';
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.values(existing);
  } catch {
    return [];
  }
}

export default {
  OUTCOMES,
  createOutcomeLink,
  linkToRepo,
  attachCommitRange,
  attachDiffSummary,
  setOutcome,
  inferOutcome,
  computeOutputScore,
  serializeLink,
  deserializeLink,
  storeLink,
  retrieveLink,
  retrieveAllLinks,
};
