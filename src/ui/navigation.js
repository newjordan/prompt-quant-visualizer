/**
 * Navigation Controls Component
 * Prev/Next arrows, counter display, and timeline scrubber
 */

export class NavigationControls {
  constructor(options = {}) {
    this.options = {
      position: options.position || 'bottom-center',
      showCounter: options.showCounter !== false,
      showTimeline: options.showTimeline || false,
      theme: options.theme || 'frost',
      ...options
    };

    this.current = 0;
    this.total = 0;
    this.nodes = [];
    this.container = null;
    this.element = null;
    this.timelineId = `pqv-timeline-${Math.random().toString(36).slice(2, 8)}`;
    this.handlers = {
      prev: [],
      next: [],
      jump: []
    };

    this._onKeydown = (event) => this._handleKeydown(event);
    this._onTimelineInput = (event) => {
      const idx = Number(event.target.value);
      if (Number.isFinite(idx)) this._emitJump(idx);
    };
  }

  /**
   * Mount the navigation controls to a container element
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this.element = this._createElement();
    this.container.appendChild(this.element);
    this._bindEvents();
  }

  /**
   * Create the navigation DOM structure
   */
  _createElement() {
    const nav = document.createElement('nav');
    nav.className = `pqv-nav pqv-nav--${this.options.position} pqv-nav--${this.options.theme}`;
    nav.id = 'pqv-navigation';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Prompt navigation');

    nav.innerHTML = `
      <div class="pqv-nav__controls frost-glass">
        <button type="button" class="pqv-nav__btn pqv-nav__btn--prev" aria-label="Previous prompt" aria-keyshortcuts="ArrowLeft" title="Previous prompt">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        ${this.options.showCounter ? `
          <div class="pqv-nav__counter">
            <span class="pqv-nav__current">0</span>
            <span class="pqv-nav__sep" aria-hidden="true">/</span>
            <span class="pqv-nav__total">0</span>
            <span class="pqv-sr-only pqv-nav__counter-text">No prompts loaded</span>
          </div>
        ` : ''}
        
        <button type="button" class="pqv-nav__btn pqv-nav__btn--next" aria-label="Next prompt" aria-keyshortcuts="ArrowRight" title="Next prompt">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      
      ${this.options.showTimeline ? `
        <div class="pqv-nav__timeline frost-glass">
          <label class="pqv-sr-only" for="${this.timelineId}">Prompt position</label>
          <div class="pqv-nav__timeline-track">
            <div class="pqv-nav__timeline-fill" aria-hidden="true"></div>
            <div class="pqv-nav__timeline-dots" aria-hidden="true"></div>
            <input
              id="${this.timelineId}"
              class="pqv-nav__range"
              type="range"
              min="0"
              max="0"
              value="0"
              step="1"
              aria-valuemin="1"
              aria-valuemax="1"
              aria-valuenow="0"
              aria-valuetext="No prompts loaded"
              disabled
            >
          </div>
        </div>
      ` : ''}
    `;

    return nav;
  }

  /**
   * Bind DOM event listeners
   */
  _bindEvents() {
    const prevBtn = this.element.querySelector('.pqv-nav__btn--prev');
    const nextBtn = this.element.querySelector('.pqv-nav__btn--next');

    prevBtn.addEventListener('click', () => this._emitPrev());
    nextBtn.addEventListener('click', () => this._emitNext());

    document.addEventListener('keydown', this._onKeydown, true);

    const range = this.element.querySelector('.pqv-nav__range');
    if (range) range.addEventListener('input', this._onTimelineInput);
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} event
   */
  _handleKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('textarea, select, [contenteditable="true"], input:not([type="range"])')) return;
    if (document.querySelector('dialog[open]')) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this._emitPrev();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this._emitNext();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this._emitJump(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this._emitJump(this.total - 1);
    } else if (event.key >= '1' && event.key <= '9') {
      const idx = parseInt(event.key, 10) - 1;
      if (idx < this.total) this._emitJump(idx);
    }
  }

  _emitPrev() {
    if (this.current > 0) {
      this.handlers.prev.forEach(h => h());
    }
  }

  _emitNext() {
    if (this.current < this.total - 1) {
      this.handlers.next.forEach(h => h());
    }
  }

  /**
   * @param {number} index
   */
  _emitJump(index) {
    if (index >= 0 && index < this.total && index !== this.current) {
      this.handlers.jump.forEach(h => h(index));
    }
  }

  /**
   * Update navigation state
   * @param {number} current - Current node index (0-based)
   * @param {number} total - Total node count
   */
  setState(current, total) {
    this.current = current;
    this.total = total;

    if (!this.element) return;

    if (this.options.showCounter) {
      const displayCurrent = total > 0 ? current + 1 : 0;
      this.element.querySelector('.pqv-nav__current').textContent = displayCurrent;
      this.element.querySelector('.pqv-nav__total').textContent = total;
      const text = this.element.querySelector('.pqv-nav__counter-text');
      if (text) {
        text.textContent = total > 0
          ? `Prompt ${displayCurrent} of ${total}`
          : 'No prompts loaded';
      }
    }

    this.setEnabled(current > 0, current < total - 1);

    if (this.options.showTimeline) {
      this._updateTimeline();
    }
  }

  /**
   * Enable/disable navigation buttons
   * @param {boolean} prev
   * @param {boolean} next
   */
  setEnabled(prev, next) {
    if (!this.element) return;

    const prevBtn = this.element.querySelector('.pqv-nav__btn--prev');
    const nextBtn = this.element.querySelector('.pqv-nav__btn--next');

    prevBtn.disabled = !prev;
    nextBtn.disabled = !next;
    prevBtn.classList.toggle('pqv-nav__btn--disabled', !prev);
    nextBtn.classList.toggle('pqv-nav__btn--disabled', !next);
  }

  /**
   * @param {Array} nodes
   */
  setNodes(nodes) {
    this.nodes = nodes;
    if (this.options.showTimeline) {
      this._renderTimelineDots();
    }
  }

  _renderTimelineDots() {
    if (!this.element) return;

    const dotsContainer = this.element.querySelector('.pqv-nav__timeline-dots');
    const track = this.element.querySelector('.pqv-nav__timeline-track');
    const range = this.element.querySelector('.pqv-nav__range');
    if (!dotsContainer || !range) return;

    dotsContainer.innerHTML = '';
    const count = this.nodes.length;
    if (track) track.style.setProperty('--pqv-node-count', String(Math.max(count, 1)));

    range.min = '0';
    range.max = String(Math.max(count - 1, 0));
    range.disabled = count <= 1;
    range.value = String(this.current);

    this.nodes.forEach((node, idx) => {
      const dot = document.createElement('span');
      dot.className = 'pqv-nav__timeline-dot';
      const complexity = node.metrics?.complexityScore || 0;
      const size = 6 + (complexity / 100) * 6;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dotsContainer.appendChild(dot);
    });

    this._updateTimeline();
  }

  _updateTimeline() {
    if (!this.element) return;

    const fill = this.element.querySelector('.pqv-nav__timeline-fill');
    const dots = this.element.querySelectorAll('.pqv-nav__timeline-dot');
    const range = this.element.querySelector('.pqv-nav__range');

    if (fill) {
      const progress = this.total > 1 ? (this.current / (this.total - 1)) * 100 : 0;
      fill.style.width = `${progress}%`;
    }

    dots.forEach((dot, idx) => {
      dot.classList.toggle('pqv-nav__timeline-dot--active', idx === this.current);
      dot.classList.toggle('pqv-nav__timeline-dot--visited', idx < this.current);
    });

    if (range && document.activeElement !== range) {
      range.value = String(this.current);
    }
    if (range) {
      const displayCurrent = this.total > 0 ? this.current + 1 : 0;
      range.setAttribute('aria-valuemin', '1');
      range.setAttribute('aria-valuemax', String(Math.max(this.total, 1)));
      range.setAttribute('aria-valuenow', String(displayCurrent));
      range.setAttribute(
        'aria-valuetext',
        this.total > 0 ? `Prompt ${displayCurrent} of ${this.total}` : 'No prompts loaded'
      );
    }
  }

  /**
   * @param {'prev'|'next'|'jump'} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  /**
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeydown, true);
    const range = this.element?.querySelector('.pqv-nav__range');
    if (range) range.removeEventListener('input', this._onTimelineInput);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.container = null;
    this.handlers = { prev: [], next: [], jump: [] };
  }
}

export default NavigationControls;
