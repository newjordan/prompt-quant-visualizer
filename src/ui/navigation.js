/**
 * Navigation Controls Component
 * Prev/Next arrows, counter display, and timeline scrubber
 * 
 * Follows SPEC.md §6.1 NavigationControls contract
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
    this.handlers = {
      prev: [],
      next: [],
      jump: []
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
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Prompt navigation');

    nav.innerHTML = `
      <div class="pqv-nav__controls frost-glass">
        <button class="pqv-nav__btn pqv-nav__btn--prev" aria-label="Previous prompt" title="Previous (←)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        ${this.options.showCounter ? `
          <div class="pqv-nav__counter">
            <span class="pqv-nav__current">0</span>
            <span class="pqv-nav__sep">/</span>
            <span class="pqv-nav__total">0</span>
          </div>
        ` : ''}
        
        <button class="pqv-nav__btn pqv-nav__btn--next" aria-label="Next prompt" title="Next (→)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      
      ${this.options.showTimeline ? `
        <div class="pqv-nav__timeline frost-glass">
          <div class="pqv-nav__timeline-track">
            <div class="pqv-nav__timeline-fill"></div>
            <div class="pqv-nav__timeline-dots"></div>
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

    // Keyboard navigation
    document.addEventListener('keydown', this._handleKeydown.bind(this));

    // Timeline click handling
    if (this.options.showTimeline) {
      const timeline = this.element.querySelector('.pqv-nav__timeline-track');
      timeline.addEventListener('click', this._handleTimelineClick.bind(this));
    }
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e 
   */
  _handleKeydown(e) {
    // Don't capture if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this._emitPrev();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this._emitNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      this._emitJump(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this._emitJump(this.total - 1);
    } else if (e.key >= '1' && e.key <= '9') {
      // Number keys for quick jump (1-9)
      const idx = parseInt(e.key) - 1;
      if (idx < this.total) {
        this._emitJump(idx);
      }
    }
  }

  /**
   * Handle timeline track clicks
   * @param {MouseEvent} e 
   */
  _handleTimelineClick(e) {
    const track = this.element.querySelector('.pqv-nav__timeline-track');
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const idx = Math.round(ratio * (this.total - 1));
    this._emitJump(Math.max(0, Math.min(this.total - 1, idx)));
  }

  /**
   * Emit prev event
   */
  _emitPrev() {
    if (this.current > 0) {
      this.handlers.prev.forEach(h => h());
    }
  }

  /**
   * Emit next event
   */
  _emitNext() {
    if (this.current < this.total - 1) {
      this.handlers.next.forEach(h => h());
    }
  }

  /**
   * Emit jump event
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

    // Update counter display (1-based for UI)
    if (this.options.showCounter) {
      this.element.querySelector('.pqv-nav__current').textContent = total > 0 ? current + 1 : 0;
      this.element.querySelector('.pqv-nav__total').textContent = total;
    }

    // Update button states
    this.setEnabled(current > 0, current < total - 1);

    // Update timeline
    if (this.options.showTimeline) {
      this._updateTimeline();
    }
  }

  /**
   * Enable/disable navigation buttons
   * @param {boolean} prev - Enable prev button
   * @param {boolean} next - Enable next button
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
   * Set the nodes array for timeline rendering
   * @param {PromptNode[]} nodes 
   */
  setNodes(nodes) {
    this.nodes = nodes;
    if (this.options.showTimeline) {
      this._renderTimelineDots();
    }
  }

  /**
   * Render timeline dot indicators
   */
  _renderTimelineDots() {
    if (!this.element) return;

    const dotsContainer = this.element.querySelector('.pqv-nav__timeline-dots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';

    this.nodes.forEach((node, idx) => {
      const dot = document.createElement('button');
      dot.className = 'pqv-nav__timeline-dot';
      dot.setAttribute('aria-label', `Go to prompt ${idx + 1}`);
      dot.setAttribute('data-index', idx);

      // Size based on complexity
      const complexity = node.metrics?.complexityScore || 0;
      const size = 6 + (complexity / 100) * 6; // 6-12px
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;

      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._emitJump(idx);
      });

      dotsContainer.appendChild(dot);
    });

    this._updateTimeline();
  }

  /**
   * Update timeline fill and active state
   */
  _updateTimeline() {
    if (!this.element) return;

    const fill = this.element.querySelector('.pqv-nav__timeline-fill');
    const dots = this.element.querySelectorAll('.pqv-nav__timeline-dot');

    if (fill && this.total > 1) {
      const progress = (this.current / (this.total - 1)) * 100;
      fill.style.width = `${progress}%`;
    }

    dots.forEach((dot, idx) => {
      dot.classList.toggle('pqv-nav__timeline-dot--active', idx === this.current);
      dot.classList.toggle('pqv-nav__timeline-dot--visited', idx < this.current);
    });
  }

  /**
   * Register event handler
   * @param {'prev'|'next'|'jump'} event 
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
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.container = null;
    this.handlers = { prev: [], next: [], jump: [] };
  }
}

export default NavigationControls;
