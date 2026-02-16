/**
 * Details Panel Component
 * Slide-out panel showing prompt text, timestamp, and all metrics
 * 
 * Follows SPEC.md §6.2 DetailsPanel contract
 */

export class DetailsPanel {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'right',
      width: options.width || 360,
      showMetrics: options.showMetrics !== false,
      showFullText: options.showFullText !== false,
      theme: options.theme || 'frost',
      ...options
    };

    this.container = null;
    this.element = null;
    this.currentNode = null;
    this.visible = false;
    this.handlers = {
      close: [],
      navigate: []
    };
  }

  /**
   * Mount the details panel to a container element
   * @param {HTMLElement} container 
   */
  mount(container) {
    this.container = container;
    this.element = this._createElement();
    this.container.appendChild(this.element);
    this._bindEvents();
  }

  /**
   * Create the panel DOM structure
   */
  _createElement() {
    const panel = document.createElement('aside');
    panel.className = `pqv-details pqv-details--${this.options.position} pqv-details--${this.options.theme}`;
    panel.style.width = `${this.options.width}px`;
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Prompt details');
    panel.setAttribute('aria-hidden', 'true');

    panel.innerHTML = `
      <div class="pqv-details__inner frost-glass">
        <header class="pqv-details__header">
          <div class="pqv-details__title">
            <span class="pqv-details__index">Prompt #—</span>
            <span class="pqv-details__time">—</span>
          </div>
          <button class="pqv-details__close" aria-label="Close panel" title="Close (Esc)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        
        <section class="pqv-details__text">
          <h4 class="pqv-details__section-title">Prompt Text</h4>
          <pre class="pqv-details__prompt-content"></pre>
        </section>
        
        ${this.options.showMetrics ? `
          <section class="pqv-details__metrics">
            <h4 class="pqv-details__section-title">Metrics</h4>
            <div class="pqv-details__metric-grid"></div>
          </section>
          
          <section class="pqv-details__tools">
            <h4 class="pqv-details__section-title">Tools Used</h4>
            <ul class="pqv-details__tool-list"></ul>
          </section>
        ` : ''}
        
        <footer class="pqv-details__nav">
          <button class="pqv-details__nav-btn pqv-details__nav-btn--prev">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Prev
          </button>
          <button class="pqv-details__nav-btn pqv-details__nav-btn--next">
            Next
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </footer>
      </div>
    `;

    return panel;
  }

  /**
   * Bind DOM event listeners
   */
  _bindEvents() {
    const closeBtn = this.element.querySelector('.pqv-details__close');
    const prevBtn = this.element.querySelector('.pqv-details__nav-btn--prev');
    const nextBtn = this.element.querySelector('.pqv-details__nav-btn--next');

    closeBtn.addEventListener('click', () => this.hide());
    prevBtn.addEventListener('click', () => this._emitNavigate('prev'));
    nextBtn.addEventListener('click', () => this._emitNavigate('next'));

    // Close on Escape key
    document.addEventListener('keydown', this._handleKeydown.bind(this));

    // Close on click outside (optional)
    document.addEventListener('click', this._handleOutsideClick.bind(this));
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e 
   */
  _handleKeydown(e) {
    if (e.key === 'Escape' && this.visible) {
      this.hide();
    }
  }

  /**
   * Handle clicks outside panel
   * @param {MouseEvent} e 
   */
  _handleOutsideClick(e) {
    if (this.visible && this.element && !this.element.contains(e.target)) {
      // Check if click was on a node (don't close)
      if (e.target.closest('.pqv-node') || e.target.closest('.pqv-nav')) return;
      // this.hide(); // Uncomment to enable click-outside-to-close
    }
  }

  /**
   * Emit navigate event
   * @param {'prev'|'next'} direction 
   */
  _emitNavigate(direction) {
    this.handlers.navigate.forEach(h => h(direction));
  }

  /**
   * Show the panel with node details
   * @param {PromptNode} node 
   */
  show(node) {
    if (!this.element || !node) return;

    this.currentNode = node;
    this.visible = true;
    this._render(node);

    this.element.classList.add('pqv-details--visible');
    this.element.setAttribute('aria-hidden', 'false');
  }

  /**
   * Render node data into the panel
   * @param {PromptNode} node 
   */
  _render(node) {
    // Index and timestamp
    const indexEl = this.element.querySelector('.pqv-details__index');
    const timeEl = this.element.querySelector('.pqv-details__time');
    
    indexEl.textContent = `Prompt #${node.index + 1}`;
    timeEl.textContent = this._formatTimestamp(node.timestamp);

    // Prompt text
    const textEl = this.element.querySelector('.pqv-details__prompt-content');
    textEl.textContent = this.options.showFullText 
      ? node.text 
      : node.textPreview || node.text.substring(0, 120) + (node.text.length > 120 ? '…' : '');

    // Metrics
    if (this.options.showMetrics && node.metrics) {
      this._renderMetrics(node.metrics);
      this._renderTools(node.metrics.toolTypes || []);
    }

    // Update nav button states
    const prevBtn = this.element.querySelector('.pqv-details__nav-btn--prev');
    const nextBtn = this.element.querySelector('.pqv-details__nav-btn--next');
    
    prevBtn.disabled = !node.prevId;
    nextBtn.disabled = !node.nextId;
    prevBtn.classList.toggle('pqv-details__nav-btn--disabled', !node.prevId);
    nextBtn.classList.toggle('pqv-details__nav-btn--disabled', !node.nextId);
  }

  /**
   * Render metrics grid
   * @param {PromptMetrics} metrics 
   */
  _renderMetrics(metrics) {
    const grid = this.element.querySelector('.pqv-details__metric-grid');
    if (!grid) return;

    const metricItems = [
      {
        label: 'Characters',
        value: metrics.charCount?.toLocaleString() || '—',
        icon: 'Aa'
      },
      {
        label: 'Words',
        value: metrics.wordCount?.toLocaleString() || '—',
        icon: 'W'
      },
      {
        label: 'Est. Tokens',
        value: `~${metrics.tokenEstimate?.toLocaleString() || '—'}`,
        icon: '#'
      },
      {
        label: 'Tools',
        value: metrics.toolCallCount || 0,
        icon: '⚙'
      },
      {
        label: 'Latency',
        value: this._formatLatency(metrics.responseLatencyMs),
        icon: '⏱'
      },
      {
        label: 'Complexity',
        value: metrics.complexityScore || 0,
        icon: '◆',
        highlight: true,
        level: this._getComplexityLevel(metrics.complexityScore)
      }
    ];

    // Add optional metrics if available
    if (metrics.similarityToPrev !== null && metrics.similarityToPrev !== undefined) {
      metricItems.push({
        label: 'Similarity',
        value: `${Math.round(metrics.similarityToPrev * 100)}%`,
        icon: '≈'
      });
    }

    if (metrics.topicDriftScore !== null && metrics.topicDriftScore !== undefined) {
      metricItems.push({
        label: 'Topic Drift',
        value: `${Math.round(metrics.topicDriftScore * 100)}%`,
        icon: '↗'
      });
    }

    // Intent classification
    if (metrics.intent) {
      const intentLabels = {
        question: 'Question', command: 'Command', clarification: 'Clarification',
        creative: 'Creative', error: 'Error/Fix', informational: 'Info'
      };
      metricItems.push({
        label: 'Intent',
        value: intentLabels[metrics.intent] || metrics.intent,
        icon: '?'
      });
    }

    // Content types
    if (metrics.contentTypes && metrics.contentTypes.length > 0) {
      const ctSummary = metrics.contentTypes
        .map(ct => `${ct.count} ${ct.type}`)
        .join(', ');
      metricItems.push({
        label: 'Content',
        value: ctSummary,
        icon: '+'
      });
    }

    grid.innerHTML = metricItems.map(item => `
      <div class="pqv-details__metric ${item.highlight ? 'pqv-details__metric--highlight' : ''} ${item.level ? `pqv-details__metric--${item.level}` : ''}">
        <span class="pqv-details__metric-icon">${item.icon}</span>
        <span class="pqv-details__metric-label">${item.label}</span>
        <span class="pqv-details__metric-value">${item.value}</span>
        ${item.label === 'Complexity' ? `
          <div class="pqv-details__metric-bar">
            <div class="pqv-details__metric-fill" style="width: ${item.value}%"></div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  /**
   * Render tools list
   * @param {string[]} tools 
   */
  _renderTools(tools) {
    const list = this.element.querySelector('.pqv-details__tool-list');
    if (!list) return;

    if (!tools || tools.length === 0) {
      list.innerHTML = '<li class="pqv-details__tool-tag pqv-details__tool-tag--empty">None</li>';
      return;
    }

    list.innerHTML = tools.map(tool => `
      <li class="pqv-details__tool-tag">${this._escapeHtml(tool)}</li>
    `).join('');
  }

  /**
   * Format timestamp for display
   * @param {number} timestamp - Unix timestamp in ms
   * @returns {string}
   */
  _formatTimestamp(timestamp) {
    if (!timestamp) return '—';
    
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Format latency for display
   * @param {number} ms 
   * @returns {string}
   */
  _formatLatency(ms) {
    if (ms === null || ms === undefined) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Get complexity level for styling
   * @param {number} score 
   * @returns {'low'|'medium'|'high'}
   */
  _getComplexityLevel(score) {
    if (score <= 33) return 'low';
    if (score <= 66) return 'medium';
    return 'high';
  }

  /**
   * Escape HTML for safe display
   * @param {string} str 
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Hide the panel
   */
  hide() {
    if (!this.element) return;

    this.visible = false;
    this.element.classList.remove('pqv-details--visible');
    this.element.setAttribute('aria-hidden', 'true');
    
    this.handlers.close.forEach(h => h());
  }

  /**
   * Check if panel is visible
   * @returns {boolean}
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Get currently displayed node
   * @returns {PromptNode|null}
   */
  getCurrentNode() {
    return this.currentNode;
  }

  /**
   * Register event handler
   * @param {'close'|'navigate'} event 
   * @param {Function} handler 
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  /**
   * Remove event handler
   * @param {string} event 
   * @param {Function} handler 
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  /**
   * Clean up and remove from DOM
   */
  dispose() {
    document.removeEventListener('keydown', this._handleKeydown);
    document.removeEventListener('click', this._handleOutsideClick);
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
