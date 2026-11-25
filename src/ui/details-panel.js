/**
 * Details Panel Component
 * Slide-out panel showing prompt text, timestamp, and metrics
 */

export class DetailsPanel {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'right',
      width: options.width || 380,
      showMetrics: options.showMetrics !== false,
      showFullText: options.showFullText !== false,
      theme: options.theme || 'frost',
      ...options
    };

    this.container = null;
    this.element = null;
    this.currentNode = null;
    this.visible = false;
    this._previouslyFocused = null;
    this.handlers = {
      close: [],
      navigate: []
    };

    this._onKeydown = (event) => this._handleKeydown(event);
  }

  /**
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this.element = this._createElement();
    this.container.appendChild(this.element);
    this._bindEvents();
  }

  _createElement() {
    const panel = document.createElement('aside');
    panel.className = `pqv-details pqv-details--${this.options.position} pqv-details--${this.options.theme}`;
    panel.style.setProperty('--pqv-details-width', `${this.options.width}px`);
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'pqv-details-title');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;

    panel.innerHTML = `
      <div class="pqv-details__inner frost-glass">
        <header class="pqv-details__header">
          <div class="pqv-details__title">
            <h2 class="pqv-details__index" id="pqv-details-title">Prompt details</h2>
            <span class="pqv-details__time">Select a prompt to inspect it</span>
          </div>
          <button type="button" class="pqv-details__close" aria-label="Close details" title="Close details">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        
        <section class="pqv-details__text" aria-labelledby="pqv-details-prompt-heading">
          <h3 class="pqv-details__section-title" id="pqv-details-prompt-heading">Prompt text</h3>
          <pre class="pqv-details__prompt-content" tabindex="0"></pre>
        </section>
        
        ${this.options.showMetrics ? `
          <section class="pqv-details__metrics" aria-labelledby="pqv-details-metrics-heading">
            <h3 class="pqv-details__section-title" id="pqv-details-metrics-heading">Metrics</h3>
            <div class="pqv-details__metric-grid"></div>
          </section>
          
          <section class="pqv-details__tools" aria-labelledby="pqv-details-tools-heading">
            <h3 class="pqv-details__section-title" id="pqv-details-tools-heading">Tools used</h3>
            <ul class="pqv-details__tool-list"></ul>
          </section>
        ` : ''}
        
        <footer class="pqv-details__nav">
          <button type="button" class="pqv-details__nav-btn pqv-details__nav-btn--prev">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Previous
          </button>
          <button type="button" class="pqv-details__nav-btn pqv-details__nav-btn--next">
            Next
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </footer>
      </div>
    `;

    return panel;
  }

  _bindEvents() {
    const closeBtn = this.element.querySelector('.pqv-details__close');
    const prevBtn = this.element.querySelector('.pqv-details__nav-btn--prev');
    const nextBtn = this.element.querySelector('.pqv-details__nav-btn--next');

    closeBtn.addEventListener('click', () => this.hide());
    prevBtn.addEventListener('click', () => this._emitNavigate('prev'));
    nextBtn.addEventListener('click', () => this._emitNavigate('next'));
    document.addEventListener('keydown', this._onKeydown);
  }

  /**
   * @param {KeyboardEvent} event
   */
  _handleKeydown(event) {
    if (event.key === 'Escape' && this.visible && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      this.hide();
    }
  }

  /**
   * @param {'prev'|'next'} direction
   */
  _emitNavigate(direction) {
    this.handlers.navigate.forEach(h => h(direction));
  }

  /**
   * Show the panel with node details.
   * Focus moves into the panel only when it was closed.
   * @param {object} node
   */
  show(node) {
    if (!this.element || !node) return;

    const wasHidden = !this.visible;
    if (wasHidden) {
      this._previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    }

    this.currentNode = node;
    this.visible = true;
    this._render(node);

    this.element.inert = false;
    this.element.classList.add('pqv-details--visible');
    this.element.setAttribute('aria-hidden', 'false');

    if (wasHidden) this.element.focus();
  }

  /**
   * @param {object} node
   */
  _render(node) {
    const indexEl = this.element.querySelector('.pqv-details__index');
    const timeEl = this.element.querySelector('.pqv-details__time');
    
    indexEl.textContent = `Prompt ${node.index + 1}`;
    timeEl.textContent = this._formatTimestamp(node.timestamp);
    timeEl.setAttribute('datetime', new Date(node.timestamp || 0).toISOString());

    const textEl = this.element.querySelector('.pqv-details__prompt-content');
    textEl.textContent = this.options.showFullText
      ? node.text
      : node.textPreview || node.text.substring(0, 120) + (node.text.length > 120 ? '…' : '');

    if (this.options.showMetrics && node.metrics) {
      this._renderMetrics(node.metrics);
      this._renderTools(node.metrics.toolTypes || []);
    }

    const prevBtn = this.element.querySelector('.pqv-details__nav-btn--prev');
    const nextBtn = this.element.querySelector('.pqv-details__nav-btn--next');
    
    prevBtn.disabled = !node.prevId;
    nextBtn.disabled = !node.nextId;
    prevBtn.classList.toggle('pqv-details__nav-btn--disabled', !node.prevId);
    nextBtn.classList.toggle('pqv-details__nav-btn--disabled', !node.nextId);
  }

  /**
   * @param {object} metrics
   */
  _renderMetrics(metrics) {
    const grid = this.element.querySelector('.pqv-details__metric-grid');
    if (!grid) return;

    const metricItems = [
      { label: 'Characters', value: metrics.charCount?.toLocaleString() || '—' },
      { label: 'Words', value: metrics.wordCount?.toLocaleString() || '—' },
      { label: 'Est. tokens', value: metrics.tokenEstimate != null ? `~${metrics.tokenEstimate.toLocaleString()}` : '—' },
      { label: 'Tools', value: metrics.toolCallCount || 0 },
      { label: 'Latency', value: this._formatLatency(metrics.responseLatencyMs) },
      {
        label: 'Complexity',
        value: metrics.complexityScore || 0,
        highlight: true,
        level: this._getComplexityLevel(metrics.complexityScore),
        meter: true
      }
    ];

    if (metrics.similarityToPrev !== null && metrics.similarityToPrev !== undefined) {
      metricItems.push({
        label: 'Similarity',
        value: `${Math.round(metrics.similarityToPrev * 100)}%`
      });
    }

    if (metrics.topicDriftScore !== null && metrics.topicDriftScore !== undefined) {
      metricItems.push({
        label: 'Topic drift',
        value: `${Math.round(metrics.topicDriftScore * 100)}%`
      });
    }

    if (metrics.thinkingIntensity) {
      metricItems.push({
        label: 'Thinking',
        value: `${Math.round(metrics.thinkingIntensity * 100)}%`
      });
    }

    grid.replaceChildren(...metricItems.map((item) => {
      const card = document.createElement('div');
      card.className = [
        'pqv-details__metric',
        item.highlight ? 'pqv-details__metric--highlight' : '',
        item.level ? `pqv-details__metric--${item.level}` : ''
      ].filter(Boolean).join(' ');

      const label = document.createElement('span');
      label.className = 'pqv-details__metric-label';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'pqv-details__metric-value';
      value.textContent = String(item.value);

      card.append(label, value);

      if (item.meter) {
        const meter = document.createElement('div');
        meter.className = 'pqv-details__metric-bar';
        meter.setAttribute('role', 'meter');
        meter.setAttribute('aria-label', 'Complexity');
        meter.setAttribute('aria-valuemin', '0');
        meter.setAttribute('aria-valuemax', '100');
        meter.setAttribute('aria-valuenow', String(item.value));

        const fill = document.createElement('div');
        fill.className = 'pqv-details__metric-fill';
        fill.style.width = `${item.value}%`;
        meter.appendChild(fill);
        card.appendChild(meter);
      }

      return card;
    }));
  }

  /**
   * @param {string[]} tools
   */
  _renderTools(tools) {
    const list = this.element.querySelector('.pqv-details__tool-list');
    if (!list) return;

    list.replaceChildren();
    if (!tools || tools.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'pqv-details__tool-tag pqv-details__tool-tag--empty';
      empty.textContent = 'None';
      list.appendChild(empty);
      return;
    }

    tools.forEach((tool) => {
      const item = document.createElement('li');
      item.className = 'pqv-details__tool-tag';
      item.textContent = tool;
      list.appendChild(item);
    });
  }

  /**
   * @param {number} timestamp
   * @returns {string}
   */
  _formatTimestamp(timestamp) {
    if (!timestamp) return 'No timestamp';
    
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'No timestamp';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * @param {number} ms
   * @returns {string}
   */
  _formatLatency(ms) {
    if (ms === null || ms === undefined || Number.isNaN(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  /**
   * @param {number} score
   * @returns {'low'|'medium'|'high'}
   */
  _getComplexityLevel(score) {
    if (score <= 33) return 'low';
    if (score <= 66) return 'medium';
    return 'high';
  }

  hide() {
    if (!this.element || !this.visible) return;

    this.visible = false;
    this.element.classList.remove('pqv-details--visible');
    this.element.setAttribute('aria-hidden', 'true');
    this.element.inert = true;

    const previous = this._previouslyFocused;
    this._previouslyFocused = null;
    if (previous && previous.isConnected && !this.element.contains(previous)) {
      previous.focus();
    }
    
    this.handlers.close.forEach(h => h());
  }

  isVisible() {
    return this.visible;
  }

  getCurrentNode() {
    return this.currentNode;
  }

  /**
   * @param {'close'|'navigate'} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeydown);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.container = null;
    this.currentNode = null;
    this.handlers = { close: [], navigate: [] };
  }
}

export default DetailsPanel;
