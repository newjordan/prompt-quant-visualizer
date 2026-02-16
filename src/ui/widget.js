/**
 * PromptQuantWidget - Main Widget Orchestrator
 * Coordinates renderer, navigation, and details panel
 * 
 * Follows SPEC.md §6.4 Widget Shell contract
 */

import { NavigationControls } from './navigation.js';
import { DetailsPanel } from './details-panel.js';
import { ShapeBadge } from './shape-badge.js';

export class PromptQuantWidget {
  constructor(options = {}) {
    this.options = {
      // Renderer options (passed to StarmapRenderer when available)
      renderer: {
        layout: 'path',
        nodeSpacing: 100,
        pathCurvature: 0.3,
        maxVisibleNodes: 200,
        enableGlow: true,
        theme: {
          nodeColor: 0x00ffcc,
          nodeColorActive: 0x00ffff,
          nodeColorHover: 0x66ffee,
          connectionColor: 0x00ffcc,
          connectionOpacity: 0.5,
          backgroundColor: 0x0a0a0f,
          satelliteColors: {
            length: 0x00aaff,
            tools: 0xffaa00,
            latency: 0xff5a5a,
            drift: 0xaa44ff
          }
        },
        ...options.renderer
      },
      
      // Navigation options
      navigation: {
        position: 'bottom-center',
        showCounter: true,
        showTimeline: true,
        theme: 'frost',
        ...options.navigation
      },
      
      // Details panel options
      details: {
        position: 'right',
        width: 360,
        showMetrics: true,
        showFullText: true,
        theme: 'frost',
        ...options.details
      },
      
      // Widget-level options
      autoPlay: options.autoPlay || false,
      autoPlayInterval: options.autoPlayInterval || 3000,
      showHeader: options.showHeader !== false,
      title: options.title || 'PROMPT.QUANT.STARMAP',
      
      ...options
    };

    this.container = null;
    this.elements = {};
    this.nodes = [];
    this.meta = null;
    this.shape = null;
    this.outcomeLink = null;
    this.currentIndex = 0;
    this.autoPlayTimer = null;

    // Sub-components
    this.renderer = null;
    this.navigation = null;
    this.detailsPanel = null;
    this.shapeBadge = null;

    // Event handlers
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
   * Mount the widget to a container element
   * @param {HTMLElement} container 
   */
  mount(container) {
    this.container = container;
    this.container.classList.add('pqv-widget');
    
    this._createStructure();
    this._initSubComponents();
    this._bindEvents();
    
    // Start autoplay if enabled
    if (this.options.autoPlay && this.nodes.length > 1) {
      this._startAutoPlay();
    }

    this._emit('ready', { widget: this });
  }

  /**
   * Create the widget DOM structure
   */
  _createStructure() {
    // Header (optional)
    if (this.options.showHeader) {
      const header = document.createElement('header');
      header.className = 'pqv-widget__header frost-glass';
      header.innerHTML = `
        <div class="pqv-widget__title">${this._escapeHtml(this.options.title)}</div>
        <div class="pqv-widget__badges">
          <span class="pqv-widget__badge pqv-widget__badge--nodes">
            <span class="pqv-widget__badge-value">0</span> nodes
          </span>
          <span class="pqv-widget__badge pqv-widget__badge--status">Ready</span>
        </div>
      `;
      this.container.appendChild(header);
      this.elements.header = header;
    }

    // Main viewport (for Three.js renderer)
    const viewport = document.createElement('div');
    viewport.className = 'pqv-widget__viewport';
    viewport.id = 'pqv-viewport';
    this.container.appendChild(viewport);
    this.elements.viewport = viewport;

    // Canvas placeholder (actual canvas created by renderer)
    const canvasPlaceholder = document.createElement('div');
    canvasPlaceholder.className = 'pqv-widget__canvas-placeholder';
    canvasPlaceholder.innerHTML = `
      <div class="pqv-widget__loading">
        <div class="pqv-widget__loading-spinner"></div>
        <span>Initializing starmap...</span>
      </div>
    `;
    viewport.appendChild(canvasPlaceholder);
    this.elements.canvasPlaceholder = canvasPlaceholder;

    // UI overlay container
    const overlay = document.createElement('div');
    overlay.className = 'pqv-widget__overlay';
    this.container.appendChild(overlay);
    this.elements.overlay = overlay;
  }

  /**
   * Initialize sub-components
   */
  _initSubComponents() {
    // Navigation controls
    this.navigation = new NavigationControls(this.options.navigation);
    this.navigation.mount(this.elements.overlay);

    // Details panel
    this.detailsPanel = new DetailsPanel(this.options.details);
    this.detailsPanel.mount(this.elements.overlay);

    // Session shape badge (at-a-glance session classification)
    this.shapeBadge = new ShapeBadge({ position: 'top-left' });
    this.shapeBadge.mount(this.elements.overlay);

    // Renderer will be initialized when viz module is available
    // For now, we'll expose a hook for the viz engineer to connect
    this._initRenderer();
  }

  /**
   * Initialize the Three.js renderer
   * This method checks if StarmapRenderer is available and initializes it
   */
  async _initRenderer() {
    try {
      // Try to import the renderer dynamically
      // The viz engineer will create this module
      const vizModule = await import('../viz/starmap.js').catch(() => null);
      
      if (vizModule && vizModule.StarmapRenderer) {
        this.renderer = new vizModule.StarmapRenderer(this.options.renderer);
        this.renderer.mount(this.elements.viewport);
        
        // Connect renderer events
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
        
        // If nodes are already loaded, pass them to renderer
        if (this.nodes.length > 0) {
          this.renderer.setNodes(this.nodes, this.shape);
          this.renderer.focusNode(this.currentIndex);
        }
      } else {
        // Renderer not available yet, show placeholder visualization
        this._showPlaceholder();
      }
    } catch (err) {
      console.warn('StarmapRenderer not available:', err);
      this._showPlaceholder();
    }
  }

  /**
   * Show placeholder when renderer is not available
   */
  _showPlaceholder() {
    if (!this.elements.canvasPlaceholder) return;

    this.elements.canvasPlaceholder.innerHTML = `
      <div class="pqv-widget__placeholder">
        <div class="pqv-placeholder__nodes"></div>
        <p class="pqv-placeholder__text">
          Load a session to visualize the starmap
        </p>
      </div>
    `;
  }

  /**
   * Hide loading indicator
   */
  _hideLoading() {
    if (this.elements.canvasPlaceholder) {
      this.elements.canvasPlaceholder.style.display = 'none';
    }
  }

  /**
   * Bind event handlers between components
   */
  _bindEvents() {
    // Navigation events
    this.navigation.on('prev', () => this.goPrev());
    this.navigation.on('next', () => this.goNext());
    this.navigation.on('jump', (index) => this.goToNode(index));

    // Details panel navigation
    this.detailsPanel.on('navigate', (direction) => {
      if (direction === 'prev') this.goPrev();
      else if (direction === 'next') this.goNext();
    });

    this.detailsPanel.on('close', () => {
      // Optionally deselect node when panel closes
    });
  }

  /**
   * Load session from JSONL file path
   * @param {string} jsonlPath - Path to session file
   * @returns {Promise<void>}
   */
  async loadSession(jsonlPath) {
    try {
      this._updateStatus('Loading...');

      // Try to import the parser dynamically
      const dataModule = await import('../data/parser.js').catch(() => null);
      
      if (dataModule && dataModule.parseSession) {
        const result = await dataModule.parseSession(jsonlPath);
        
        if (result.success) {
          this.loadNodes(result.nodes);
          this.meta = result.meta;
          this.shape = result.shape || null;
          this.outcomeLink = result.outcomeLink || null;

          // Update shape badge with session-level analysis
          if (this.shapeBadge && this.shape) {
            this.shapeBadge.update(this.shape, this.outcomeLink);
          }

          this._emit('session:loaded', {
            nodes: result.nodes, meta: result.meta,
            shape: this.shape, outcomeLink: this.outcomeLink
          });
          this._updateStatus('Loaded');
        } else {
          throw new Error(result.errors.map(e => e.message).join(', '));
        }
      } else {
        // Parser not available, try fetching and parsing manually
        await this._loadSessionManual(jsonlPath);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      this._updateStatus('Error');
      this._emit('error', { error: err, context: 'loadSession' });
    }
  }

  /**
   * Manual session loading fallback
   * @param {string} jsonlPath 
   */
  async _loadSessionManual(jsonlPath) {
    const response = await fetch(jsonlPath);
    const text = await response.text();
    const lines = text.trim().split('\n').filter(Boolean);
    
    const nodes = [];
    let index = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.role === 'user') {
          nodes.push({
            id: `node-${index}`,
            index: index,
            text: entry.content || '',
            textPreview: (entry.content || '').substring(0, 120) + (entry.content?.length > 120 ? '…' : ''),
            timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now() - (lines.length - index) * 60000,
            metrics: {
              charCount: (entry.content || '').length,
              wordCount: (entry.content || '').split(/\s+/).filter(Boolean).length,
              tokenEstimate: Math.ceil((entry.content || '').length / 4),
              toolCallCount: 0,
              toolTypes: [],
              responseLatencyMs: 0,
              similarityToPrev: null,
              topicDriftScore: null,
              complexityScore: Math.min(100, Math.ceil((entry.content || '').length / 20))
            },
            position: { x: 0, y: 0, z: 0 },
            prevId: index > 0 ? `node-${index - 1}` : null,
            nextId: null
          });
          index++;
        }
      } catch (e) {
        console.warn('Failed to parse line:', line, e);
      }
    }

    // Set next IDs
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].nextId = nodes[i + 1].id;
    }

    this.loadNodes(nodes);
    this._emit('session:loaded', { nodes, meta: null });
  }

  /**
   * Load nodes directly
   * @param {PromptNode[]} nodes 
   */
  loadNodes(nodes) {
    this.nodes = nodes;
    this.currentIndex = 0;

    // Update navigation
    this.navigation.setNodes(nodes);
    this.navigation.setState(0, nodes.length);

    // Update header badges
    this._updateBadges();

    // Update renderer (pass shape for shape-driven layout)
    if (this.renderer) {
      this.renderer.setNodes(nodes, this.shape);
      this.renderer.focusNode(0);
    } else {
      // Update placeholder with node previews
      this._renderPlaceholderNodes();
    }

    // Show first node details
    if (nodes.length > 0) {
      // Don't auto-show details panel on load
      // this.detailsPanel.show(nodes[0]);
      this._hideLoading();
    }

    this._emit('node:change', { node: nodes[0], index: 0 });
  }

  /**
   * Render placeholder node visualization
   */
  _renderPlaceholderNodes() {
    const container = this.elements.canvasPlaceholder?.querySelector('.pqv-placeholder__nodes');
    if (!container || this.nodes.length === 0) return;

    // Create simple CSS node representation
    container.innerHTML = this.nodes.slice(0, 20).map((node, i) => {
      const size = 20 + (node.metrics?.complexityScore || 0) / 5;
      const active = i === this.currentIndex;
      return `
        <div class="pqv-placeholder__node ${active ? 'pqv-placeholder__node--active' : ''}"
             style="width: ${size}px; height: ${size}px;"
             data-index="${i}"
             title="Prompt #${i + 1}">
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.pqv-placeholder__node').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        this.goToNode(idx);
        this.detailsPanel.show(this.nodes[idx]);
      });
    });

    // Update placeholder text
    const textEl = this.elements.canvasPlaceholder?.querySelector('.pqv-placeholder__text');
    if (textEl) {
      textEl.textContent = `${this.nodes.length} prompts loaded • Click a node to view details`;
    }
  }

  /**
   * Navigate to a specific node
   * @param {number} index 
   */
  goToNode(index) {
    if (index < 0 || index >= this.nodes.length) return;
    if (index === this.currentIndex) return;

    this.currentIndex = index;
    const node = this.nodes[index];

    // Update navigation
    this.navigation.setState(index, this.nodes.length);

    // Update renderer
    if (this.renderer) {
      this.renderer.focusNode(index);
    }

    // Update details if visible
    if (this.detailsPanel.isVisible()) {
      this.detailsPanel.show(node);
    }

    // Update placeholder
    this._updatePlaceholderActive();

    this._emit('node:change', { node, index });
  }

  /**
   * Navigate to next node
   */
  goNext() {
    if (this.currentIndex < this.nodes.length - 1) {
      this.goToNode(this.currentIndex + 1);
    } else if (this.options.autoPlay) {
      // Loop back to start in autoplay mode
      this.goToNode(0);
    }
  }

  /**
   * Navigate to previous node
   */
  goPrev() {
    if (this.currentIndex > 0) {
      this.goToNode(this.currentIndex - 1);
    }
  }

  /**
   * Get current node
   * @returns {PromptNode|null}
   */
  getCurrentNode() {
    return this.nodes[this.currentIndex] || null;
  }

  /**
   * Start autoplay mode
   */
  _startAutoPlay() {
    this._stopAutoPlay();
    this.autoPlayTimer = setInterval(() => {
      this.goNext();
    }, this.options.autoPlayInterval);
  }

  /**
   * Stop autoplay mode
   */
  _stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  /**
   * Update header badges
   */
  _updateBadges() {
    if (!this.elements.header) return;

    const nodesValue = this.elements.header.querySelector('.pqv-widget__badge--nodes .pqv-widget__badge-value');
    if (nodesValue) {
      nodesValue.textContent = this.nodes.length;
    }
  }

  /**
   * Update status badge
   * @param {string} status 
   */
  _updateStatus(status) {
    if (!this.elements.header) return;

    const statusEl = this.elements.header.querySelector('.pqv-widget__badge--status');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.classList.toggle('pqv-widget__badge--ok', status === 'Loaded' || status === 'Ready');
      statusEl.classList.toggle('pqv-widget__badge--error', status === 'Error');
    }
  }

  /**
   * Update placeholder active node styling
   */
  _updatePlaceholderActive() {
    const nodes = this.elements.canvasPlaceholder?.querySelectorAll('.pqv-placeholder__node');
    if (!nodes) return;

    nodes.forEach((el, i) => {
      el.classList.toggle('pqv-placeholder__node--active', i === this.currentIndex);
    });
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
   * Emit event to handlers
   * @param {string} event 
   * @param {*} payload 
   */
  _emit(event, payload) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(h => h(payload));
    }
  }

  /**
   * Register event handler
   * @param {string} event 
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
   * Get the renderer instance (for external integration)
   * @returns {StarmapRenderer|null}
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Get session metadata
   * @returns {SessionMeta|null}
   */
  getMeta() {
    return this.meta;
  }

  /**
   * Get all nodes
   * @returns {PromptNode[]}
   */
  getNodes() {
    return this.nodes;
  }

  /**
   * Get session shape analysis
   * @returns {import('../data/session-shape.js').SessionShape|null}
   */
  getShape() {
    return this.shape;
  }

  /**
   * Get outcome link
   * @returns {import('../data/outcome-link.js').OutcomeLink|null}
   */
  getOutcomeLink() {
    return this.outcomeLink;
  }

  /**
   * Update the outcome link (e.g. after git data is fetched)
   * @param {import('../data/outcome-link.js').OutcomeLink} link
   */
  setOutcomeLink(link) {
    this.outcomeLink = link;
    if (this.shapeBadge && this.shape) {
      this.shapeBadge.update(this.shape, this.outcomeLink);
    }
  }

  /**
   * Clean up and remove from DOM
   */
  dispose() {
    this._stopAutoPlay();

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

    if (this.shapeBadge) {
      this.shapeBadge.dispose();
      this.shapeBadge = null;
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
