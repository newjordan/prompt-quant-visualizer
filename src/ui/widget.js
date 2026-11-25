/**
 * PromptQuantWidget
 * Coordinates the starmap renderer, navigation, and details panel.
 */

import { NavigationControls } from './navigation.js';
import { DetailsPanel } from './details-panel.js';
import { StarmapRenderer, DEFAULT_THEME } from '../viz/starmap.js';
import { parseSession, parseSessionFromString } from '../data/parser.js';

const LAYOUTS = [
  { id: 'path', label: 'Path' },
  { id: 'spiral', label: 'Spiral' },
  { id: 'cluster', label: 'Cluster' }
];

export class PromptQuantWidget {
  constructor(options = {}) {
    this.options = {
      renderer: {
        layout: 'path',
        nodeSpacing: 100,
        pathCurvature: 0.3,
        maxVisibleNodes: 200,
        enableGlow: true,
        theme: { ...DEFAULT_THEME },
        ...options.renderer
      },
      navigation: {
        position: 'bottom-center',
        showCounter: true,
        showTimeline: true,
        theme: 'frost',
        ...options.navigation
      },
      details: {
        position: 'right',
        width: 380,
        showMetrics: true,
        showFullText: true,
        theme: 'frost',
        ...options.details
      },
      autoPlay: options.autoPlay || false,
      autoPlayInterval: options.autoPlayInterval || 3000,
      showHeader: options.showHeader !== false,
      title: options.title || 'Prompt Quant Starmap'
    };

    this.container = null;
    this.elements = {};
    this.nodes = [];
    this.meta = null;
    this.currentIndex = 0;
    this.autoPlayTimer = null;
    this.renderer = null;
    this.navigation = null;
    this.detailsPanel = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._onMotionChange = (event) => {
      this.reducedMotion = event.matches;
      this.renderer?.setReducedMotion?.(event.matches);
    };

    this.handlers = {
      ready: [],
      'session:loaded': [],
      'node:change': [],
      'node:click': [],
      'node:hover': [],
      error: []
    };
  }

  /**
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this.container.classList.add('pqv-widget');
    
    this._createStructure();
    this._initSubComponents();
    this._bindEvents();
    this.motionMedia.addEventListener('change', this._onMotionChange);
    
    if (this.options.autoPlay && this.nodes.length > 1) {
      this._startAutoPlay();
    }

    this._emit('ready', { widget: this });
  }

  _createStructure() {
    const announcer = document.createElement('div');
    announcer.className = 'pqv-sr-only';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    this.container.appendChild(announcer);
    this.elements.announcer = announcer;

    if (this.options.showHeader) {
      const header = document.createElement('header');
      header.className = 'pqv-widget__header frost-glass';

      const brand = document.createElement('div');
      brand.className = 'pqv-widget__brand';

      const title = document.createElement('h1');
      title.className = 'pqv-widget__title';
      title.textContent = this.options.title;

      const badges = document.createElement('div');
      badges.className = 'pqv-widget__badges';
      badges.innerHTML = `
        <span class="pqv-widget__badge pqv-widget__badge--nodes">
          <span class="pqv-widget__badge-value">0</span> prompts
        </span>
        <span class="pqv-widget__badge pqv-widget__badge--status" role="status">Ready</span>
      `;
      brand.append(title, badges);

      const layout = document.createElement('div');
      layout.className = 'pqv-layout';
      layout.setAttribute('role', 'radiogroup');
      layout.setAttribute('aria-label', 'Starmap layout');
      LAYOUTS.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pqv-layout__btn';
        button.dataset.layout = item.id;
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(item.id === this.options.renderer.layout));
        button.textContent = item.label;
        button.addEventListener('click', () => this.setLayout(item.id));
        layout.appendChild(button);
      });

      const actions = document.createElement('div');
      actions.className = 'pqv-widget__actions';

      header.append(brand, layout, actions);
      this.container.appendChild(header);
      this.elements.header = header;
      this.elements.actions = actions;
    }

    const viewport = document.createElement('div');
    viewport.className = 'pqv-widget__viewport';
    this.container.appendChild(viewport);
    this.elements.viewport = viewport;

    const canvasPlaceholder = document.createElement('div');
    canvasPlaceholder.className = 'pqv-widget__canvas-placeholder';
    canvasPlaceholder.innerHTML = `
      <div class="pqv-widget__loading" role="status">
        <div class="pqv-widget__loading-spinner" aria-hidden="true"></div>
        <span>Initializing starmap</span>
      </div>
    `;
    viewport.appendChild(canvasPlaceholder);
    this.elements.canvasPlaceholder = canvasPlaceholder;

    const overlay = document.createElement('div');
    overlay.className = 'pqv-widget__overlay';
    this.container.appendChild(overlay);
    this.elements.overlay = overlay;

    const legend = document.createElement('ul');
    legend.className = 'pqv-legend frost-glass';
    legend.setAttribute('aria-label', 'Satellite legend');
    legend.innerHTML = `
      <li><span class="pqv-legend__swatch pqv-legend__swatch--length" aria-hidden="true"></span> Length</li>
      <li><span class="pqv-legend__swatch pqv-legend__swatch--tools" aria-hidden="true"></span> Tools</li>
      <li><span class="pqv-legend__swatch pqv-legend__swatch--latency" aria-hidden="true"></span> Latency</li>
      <li><span class="pqv-legend__swatch pqv-legend__swatch--drift" aria-hidden="true"></span> Drift</li>
    `;
    overlay.appendChild(legend);
  }

  _initSubComponents() {
    this.navigation = new NavigationControls(this.options.navigation);
    this.navigation.mount(this.elements.overlay);

    this.detailsPanel = new DetailsPanel(this.options.details);
    this.detailsPanel.mount(this.elements.overlay);

    this._initRenderer();
  }

  _initRenderer() {
    try {
      this.renderer = new StarmapRenderer({
        ...this.options.renderer,
        reducedMotion: this.reducedMotion
      });
      this.renderer.mount(this.elements.viewport);

      this.renderer.on('node:click', (payload) => {
        this.goToNode(payload.index);
        this.detailsPanel.show(payload.node);
        this._emit('node:click', payload);
      });

      this.renderer.on('node:hover', (payload) => {
        this._emit('node:hover', payload);
      });

      this.renderer.on('ready', () => {
        this._hideLoading();
      });

      if (this.nodes.length > 0) {
        this.renderer.setNodes(this.nodes);
        this.renderer.focusNode(this.currentIndex, false);
      }
    } catch (err) {
      console.error('Failed to initialize renderer:', err);
      this.renderer = null;
      this._emit('error', { error: err, context: 'initRenderer' });
      this._showPlaceholder();
    }
  }

  _showPlaceholder() {
    if (!this.elements.canvasPlaceholder) return;
    this.elements.canvasPlaceholder.style.display = '';
    this.elements.canvasPlaceholder.innerHTML = `
      <div class="pqv-widget__placeholder">
        <div class="pqv-placeholder__nodes"></div>
        <p class="pqv-placeholder__text">Load a session to visualize the starmap</p>
      </div>
    `;
  }

  _hideLoading() {
    if (this.elements.canvasPlaceholder) {
      this.elements.canvasPlaceholder.style.display = 'none';
    }
  }

  _bindEvents() {
    this.navigation.on('prev', () => this.goPrev());
    this.navigation.on('next', () => this.goNext());
    this.navigation.on('jump', (index) => this.goToNode(index));

    this.detailsPanel.on('navigate', (direction) => {
      if (direction === 'prev') this.goPrev();
      else if (direction === 'next') this.goNext();
    });
  }

  /**
   * Element where the host page can place extra toolbar actions.
   * @returns {HTMLElement|null}
   */
  getActionsElement() {
    return this.elements.actions || null;
  }

  /**
   * @param {'path'|'spiral'|'cluster'} layout
   */
  setLayout(layout) {
    if (!LAYOUTS.some((item) => item.id === layout)) return;
    if (layout === this.options.renderer.layout) return;

    this.options.renderer.layout = layout;
    const changed = this.renderer?.setLayout?.(layout) !== false;
    this._syncLayoutButtons();
    if (changed) {
      const label = LAYOUTS.find((item) => item.id === layout)?.label || layout;
      this._announce(`${label} layout`);
    }
  }

  _syncLayoutButtons() {
    if (!this.elements.header) return;
    this.elements.header.querySelectorAll('.pqv-layout__btn').forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.layout === this.options.renderer.layout));
    });
  }

  /**
   * @param {string} status
   */
  setStatus(status) {
    this._updateStatus(status);
  }

  /**
   * Load a session from a URL or path the browser can fetch.
   * @param {string} jsonlPath
   */
  async loadSession(jsonlPath) {
    try {
      this._updateStatus('Loading');
      const result = await parseSession(jsonlPath);
      if (!result.success) {
        throw new Error('No user prompts found. Use an OpenClaw session or lines with role and content.');
      }
      this.loadNodes(result.nodes, result.meta);
      this._updateStatus('Loaded');
      this._emit('session:loaded', { nodes: result.nodes, meta: result.meta });
      return result;
    } catch (err) {
      console.error('Failed to load session:', err);
      this._updateStatus('Error');
      this._emit('error', { error: err, context: 'loadSession' });
      return { success: false, nodes: [], meta: null, errors: [{ line: 0, message: err.message }] };
    }
  }

  /**
   * Parse transcript text already in memory.
   * Supports OpenClaw session JSONL and simple `{ role, content }` lines.
   * @param {string} text
   * @param {string} [sessionId]
   */
  loadSessionText(text, sessionId = 'upload') {
    try {
      const result = parseSessionFromString(text, sessionId);
      if (!result.success) {
        const error = new Error('No user prompts found. Use an OpenClaw session or lines with role and content.');
        this._updateStatus('Error');
        this._emit('error', { error, context: 'loadSessionText', errors: result.errors });
        return result;
      }
      this.loadNodes(result.nodes, result.meta);
      this._updateStatus('Loaded');
      this._emit('session:loaded', { nodes: result.nodes, meta: result.meta });
      return result;
    } catch (err) {
      this._updateStatus('Error');
      this._emit('error', { error: err, context: 'loadSessionText' });
      return { success: false, nodes: [], meta: null, errors: [{ line: 0, message: err.message }] };
    }
  }

  /**
   * @param {Array} nodes
   * @param {object|null} [meta]
   */
  loadNodes(nodes, meta = null) {
    this.nodes = nodes;
    this.meta = meta;
    this.currentIndex = 0;

    this.navigation.setNodes(nodes);
    this.navigation.setState(0, nodes.length);
    this._updateBadges();

    if (this.renderer) {
      this.renderer.setNodes(nodes);
      this.renderer.focusNode(0, false);
    } else {
      this._renderPlaceholderNodes();
    }

    if (nodes.length > 0) this._hideLoading();

    const label = meta?.sessionId === 'demo'
      ? `Demo session loaded, ${nodes.length} prompts.`
      : `Loaded ${nodes.length} prompts.`;
    this._announce(nodes[0]
      ? `${label} Prompt 1. ${this._preview(nodes[0])}`
      : label);
    this._emit('node:change', { node: nodes[0] || null, index: 0 });
  }

  _renderPlaceholderNodes() {
    const container = this.elements.canvasPlaceholder?.querySelector('.pqv-placeholder__nodes');
    if (!container || this.nodes.length === 0) return;

    container.replaceChildren(...this.nodes.slice(0, 20).map((node, i) => {
      const size = 20 + (node.metrics?.complexityScore || 0) / 5;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pqv-placeholder__node${i === this.currentIndex ? ' pqv-placeholder__node--active' : ''}`;
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.dataset.index = String(i);
      button.setAttribute('aria-label', `Prompt ${i + 1}: ${this._preview(node)}`);
      button.addEventListener('click', () => {
        this.goToNode(i);
        this.detailsPanel.show(this.nodes[i]);
      });
      return button;
    }));

    const textEl = this.elements.canvasPlaceholder?.querySelector('.pqv-placeholder__text');
    if (textEl) {
      textEl.textContent = `${this.nodes.length} prompts loaded. Choose a prompt to view details.`;
    }
  }

  /**
   * @param {number} index
   */
  goToNode(index) {
    if (index < 0 || index >= this.nodes.length) return;
    if (index === this.currentIndex) return;

    this.currentIndex = index;
    const node = this.nodes[index];

    this.navigation.setState(index, this.nodes.length);

    if (this.renderer) this.renderer.focusNode(index);
    if (this.detailsPanel.isVisible()) this.detailsPanel.show(node);
    this._updatePlaceholderActive();

    this._announce(`Prompt ${index + 1} of ${this.nodes.length}. ${this._preview(node)}`);
    this._emit('node:change', { node, index });
  }

  goNext() {
    if (this.currentIndex < this.nodes.length - 1) {
      this.goToNode(this.currentIndex + 1);
    } else if (this.options.autoPlay) {
      this.goToNode(0);
    }
  }

  goPrev() {
    if (this.currentIndex > 0) this.goToNode(this.currentIndex - 1);
  }

  getCurrentNode() {
    return this.nodes[this.currentIndex] || null;
  }

  _startAutoPlay() {
    this._stopAutoPlay();
    this.autoPlayTimer = setInterval(() => {
      this.goNext();
    }, this.options.autoPlayInterval);
  }

  _stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  _updateBadges() {
    if (!this.elements.header) return;
    const nodesValue = this.elements.header.querySelector('.pqv-widget__badge--nodes .pqv-widget__badge-value');
    if (nodesValue) nodesValue.textContent = String(this.nodes.length);
  }

  /**
   * @param {string} status
   */
  _updateStatus(status) {
    if (!this.elements.header) return;
    const statusEl = this.elements.header.querySelector('.pqv-widget__badge--status');
    if (!statusEl) return;
    statusEl.textContent = status;
    statusEl.classList.toggle('pqv-widget__badge--ok', status === 'Loaded' || status === 'Ready' || status === 'Demo');
    statusEl.classList.toggle('pqv-widget__badge--error', status === 'Error');
  }

  _updatePlaceholderActive() {
    const nodes = this.elements.canvasPlaceholder?.querySelectorAll('.pqv-placeholder__node');
    if (!nodes) return;
    nodes.forEach((el, i) => {
      el.classList.toggle('pqv-placeholder__node--active', i === this.currentIndex);
    });
  }

  /**
   * @param {object} node
   */
  _preview(node) {
    return (node.textPreview || node.text || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {string} message
   */
  _announce(message) {
    const el = this.elements.announcer;
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }

  /**
   * @param {string} event
   * @param {*} payload
   */
  _emit(event, payload) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(h => h(payload));
    }
  }

  on(event, handler) {
    if (this.handlers[event]) this.handlers[event].push(handler);
  }

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  getRenderer() {
    return this.renderer;
  }

  getMeta() {
    return this.meta;
  }

  getNodes() {
    return this.nodes;
  }

  dispose() {
    this._stopAutoPlay();
    this.motionMedia.removeEventListener('change', this._onMotionChange);

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.navigation) {
      this.navigation.dispose();
      this.navigation = null;
    }
    if (this.detailsPanel) {
      this.detailsPanel.dispose();
      this.detailsPanel = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container.classList.remove('pqv-widget');
    }

    this.container = null;
    this.elements = {};
    this.nodes = [];
    this.handlers = {
      ready: [],
      'session:loaded': [],
      'node:change': [],
      'node:click': [],
      'node:hover': [],
      error: []
    };
  }
}

export default PromptQuantWidget;
