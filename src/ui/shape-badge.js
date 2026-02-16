/**
 * Shape Badge — At-a-glance session shape indicator
 * @module ui/shape-badge
 *
 * This is the "look at it and know" component.
 * Shows the session classification, shape descriptors as bars,
 * and drift/complexity sparklines — all in a compact frost-glass badge.
 */

import { SESSION_CLASSIFICATIONS } from '../data/session-shape.js';
import { OUTCOMES } from '../data/outcome-link.js';

export class ShapeBadge {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'top-left',
      compact: options.compact || false,
      ...options,
    };

    this.container = null;
    this.element = null;
    this.shape = null;
    this.outcomeLink = null;
  }

  /**
   * Mount the badge to a container.
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = `pqv-shape-badge pqv-shape-badge--${this.options.position}`;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'Session shape');
    this.container.appendChild(this.element);
    this._renderEmpty();
  }

  /**
   * Update the badge with session shape data.
   * @param {import('../data/session-shape.js').SessionShape} shape
   * @param {import('../data/outcome-link.js').OutcomeLink} [outcomeLink]
   */
  update(shape, outcomeLink) {
    this.shape = shape;
    this.outcomeLink = outcomeLink || null;
    if (this.element) this._render();
  }

  _renderEmpty() {
    this.element.innerHTML = `
      <div class="pqv-shape-badge__inner frost-glass">
        <div class="pqv-shape-badge__label">No session loaded</div>
      </div>
    `;
  }

  _render() {
    const s = this.shape;
    if (!s || s.nodeCount === 0) {
      this._renderEmpty();
      return;
    }

    const classInfo = SESSION_CLASSIFICATIONS[s.classification] || SESSION_CLASSIFICATIONS.mixed;
    const colorHex = '#' + classInfo.color.toString(16).padStart(6, '0');

    const outcomeHtml = this._renderOutcome();
    const sparklineHtml = this.options.compact ? '' : this._renderSparklines(s);

    this.element.innerHTML = `
      <div class="pqv-shape-badge__inner frost-glass">
        <div class="pqv-shape-badge__header">
          <span class="pqv-shape-badge__classification" style="color: ${colorHex}">
            ${this._escapeHtml(classInfo.label)}
          </span>
          <span class="pqv-shape-badge__node-count">${s.nodeCount} prompts</span>
          ${s.durationMs > 0 ? `<span class="pqv-shape-badge__duration">${this._formatDuration(s.durationMs)}</span>` : ''}
        </div>

        <div class="pqv-shape-badge__description">${this._escapeHtml(classInfo.description)}</div>

        <div class="pqv-shape-badge__bars">
          ${this._renderBar('Linearity', s.linearity, colorHex)}
          ${this._renderBar('Density', s.density, colorHex)}
          ${this._renderBar('Rhythm', s.rhythm, colorHex)}
          ${this._renderBar('Breadth', s.breadth, colorHex)}
          ${this._renderConvergenceBar(s.convergence, colorHex)}
          ${this._renderBar('Momentum', s.momentum, colorHex)}
        </div>

        ${sparklineHtml}
        ${outcomeHtml}
      </div>
    `;
  }

  _renderBar(label, value, color) {
    const pct = Math.round(value * 100);
    return `
      <div class="pqv-shape-badge__bar">
        <span class="pqv-shape-badge__bar-label">${label}</span>
        <div class="pqv-shape-badge__bar-track">
          <div class="pqv-shape-badge__bar-fill" style="width: ${pct}%; background: ${color}"></div>
        </div>
        <span class="pqv-shape-badge__bar-value">${pct}</span>
      </div>
    `;
  }

  _renderConvergenceBar(value, color) {
    // Convergence is -1 to 1. Show as a centered bar.
    const pct = Math.round(Math.abs(value) * 50); // 0-50% from center
    const isConverging = value > 0;
    const label = isConverging ? 'Converging' : (value < -0.05 ? 'Diverging' : 'Neutral');

    return `
      <div class="pqv-shape-badge__bar pqv-shape-badge__bar--convergence">
        <span class="pqv-shape-badge__bar-label">${label}</span>
        <div class="pqv-shape-badge__bar-track pqv-shape-badge__bar-track--centered">
          <div class="pqv-shape-badge__bar-center"></div>
          <div class="pqv-shape-badge__bar-fill pqv-shape-badge__bar-fill--convergence"
               style="width: ${pct}%; ${isConverging ? 'right' : 'left'}: 50%; background: ${color}; opacity: 0.7">
          </div>
        </div>
        <span class="pqv-shape-badge__bar-value">${value > 0 ? '+' : ''}${Math.round(value * 100)}</span>
      </div>
    `;
  }

  _renderSparklines(shape) {
    const driftSvg = this._sparklineSvg(shape.driftProfile, '#AA44FF', 0, 1);
    const complexitySvg = this._sparklineSvg(shape.complexityProfile, '#00FFCC', 0, 100);

    return `
      <div class="pqv-shape-badge__sparklines">
        <div class="pqv-shape-badge__sparkline">
          <span class="pqv-shape-badge__sparkline-label">Drift</span>
          ${driftSvg}
        </div>
        <div class="pqv-shape-badge__sparkline">
          <span class="pqv-shape-badge__sparkline-label">Complexity</span>
          ${complexitySvg}
        </div>
      </div>
    `;
  }

  _sparklineSvg(values, color, min, max) {
    if (!values || values.length < 2) return '<svg class="pqv-sparkline" viewBox="0 0 100 24"></svg>';

    const w = 100;
    const h = 24;
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
      <svg class="pqv-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      </svg>
    `;
  }

  _renderOutcome() {
    if (!this.outcomeLink || this.outcomeLink.outcome === 'unknown') return '';

    const outcomeInfo = OUTCOMES[this.outcomeLink.outcome] || OUTCOMES.unknown;
    const colorHex = '#' + outcomeInfo.color.toString(16).padStart(6, '0');

    let details = '';
    if (this.outcomeLink.repo) {
      const repoName = this.outcomeLink.repo.split('/').pop() || this.outcomeLink.repo;
      details += `<span class="pqv-shape-badge__outcome-repo">${this._escapeHtml(repoName)}</span>`;
    }
    if (this.outcomeLink.branch) {
      details += `<span class="pqv-shape-badge__outcome-branch">${this._escapeHtml(this.outcomeLink.branch)}</span>`;
    }
    if (this.outcomeLink.commitRange) {
      details += `<span class="pqv-shape-badge__outcome-commits">${this.outcomeLink.commitRange.count} commits</span>`;
    }

    return `
      <div class="pqv-shape-badge__outcome">
        <span class="pqv-shape-badge__outcome-label" style="color: ${colorHex}">
          ${this._escapeHtml(outcomeInfo.label)}
        </span>
        ${details}
      </div>
    `;
  }

  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainMin = minutes % 60;
    return `${hours}h${remainMin > 0 ? ` ${remainMin}m` : ''}`;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  dispose() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.container = null;
    this.shape = null;
    this.outcomeLink = null;
  }
}

export default ShapeBadge;
