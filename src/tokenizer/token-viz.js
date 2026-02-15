/**
 * <token-viz> Web Component
 *
 * A self-contained, droppable tokenizer visualization element.
 * Renders inline token chips in a framed container, and exposes
 * a Three.js scene hook for 3D visualization overlay.
 *
 * Usage:
 *   <token-viz vocab="cl100k_base" mode="chips"></token-viz>
 *
 * Modes:
 *   - "chips": Inline colored token pills (default)
 *   - "3d": Three.js 3D token space (your visual layer)
 *   - "both": Chips input + 3D viewport stacked
 *
 * Events emitted:
 *   - "tokenize": { detail: { tokens, total_tokens, vocab_id, text } }
 *   - "ready": Bridge initialized
 *   - "vocab-change": { detail: { vocabId } }
 *
 * Three.js hook:
 *   element.getScene()       → Three.js Scene (created lazily)
 *   element.getCamera()      → Three.js PerspectiveCamera
 *   element.getRenderer()    → Three.js WebGLRenderer
 *   element.getTokenData()   → Latest tokenization result
 *   element.onTokenUpdate(fn) → Subscribe to token changes
 */

import { TokenizerBridge } from './bridge.js';

const STYLE = `
  :host {
    display: block;
    position: relative;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    --pq-bg: rgba(10, 14, 20, 0.85);
    --pq-border: rgba(125, 244, 255, 0.15);
    --pq-glow: rgba(0, 255, 204, 0.3);
    --pq-text: #c8d6e5;
    --pq-input-bg: rgba(15, 20, 30, 0.9);
    --pq-chip-gap: 2px;
  }

  .frame {
    border: 1px solid var(--pq-border);
    border-radius: 8px;
    background: var(--pq-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--pq-border);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(125, 244, 255, 0.6);
    user-select: none;
  }

  .header .count {
    color: rgba(0, 255, 204, 0.8);
    font-variant-numeric: tabular-nums;
  }

  .vocab-select {
    background: transparent;
    border: 1px solid var(--pq-border);
    border-radius: 4px;
    color: var(--pq-text);
    font-family: inherit;
    font-size: 9px;
    padding: 2px 6px;
    cursor: pointer;
    outline: none;
  }
  .vocab-select:focus {
    border-color: rgba(0, 255, 204, 0.5);
  }

  .input-area {
    position: relative;
    min-height: 48px;
  }

  .input-area textarea {
    width: 100%;
    min-height: 48px;
    background: var(--pq-input-bg);
    border: none;
    color: transparent;
    caret-color: rgba(0, 255, 204, 0.8);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
    padding: 10px 12px;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }

  .chips-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 12px;
    pointer-events: none;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
  }

  .token-chip {
    display: inline;
    border-radius: 3px;
    padding: 0 1px;
    margin: 0;
    border-bottom: 2px solid var(--chip-color, rgba(125, 244, 255, 0.4));
    background: var(--chip-bg, rgba(125, 244, 255, 0.06));
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .token-chip.whitespace {
    border-bottom-color: transparent;
    background: transparent;
  }

  .viewport-3d {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 200px;
    background: rgba(5, 8, 14, 0.95);
    border-top: 1px solid var(--pq-border);
  }

  .viewport-3d canvas {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .mode-chips .viewport-3d { display: none; }
  .mode-3d .input-area { display: none; }
  .mode-3d .header { display: none; }
`;

export class TokenVizElement extends HTMLElement {
  static get observedAttributes() {
    return ['vocab', 'mode', 'placeholder'];
  }

  // Three.js instances (created lazily when mode includes 3d)
  #scene = null;
  #camera = null;
  #renderer = null;
  #animFrameId = null;

  // Tokenizer
  #bridge = null;
  #lastResult = null;
  #tokenListeners = new Set();

  // DOM refs
  #shadow = null;
  #textarea = null;
  #chipsOverlay = null;
  #viewport = null;
  #countEl = null;
  #vocabSelect = null;

  // Config
  #mode = 'chips';
  #vocab = 'cl100k_base';
  #debounceTimer = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#mode = this.getAttribute('mode') || 'chips';
    this.#vocab = this.getAttribute('vocab') || 'cl100k_base';

    this.#render();
    this.#initBridge();
  }

  disconnectedCallback() {
    this.#dispose();
  }

  attributeChangedCallback(name, _old, val) {
    if (name === 'vocab' && val && val !== this.#vocab) {
      this.#vocab = val;
      if (this.#bridge?.ready) {
        this.#bridge.setVocab(val);
        this.#retokenize();
      }
    }
    if (name === 'mode' && val && val !== this.#mode) {
      this.#mode = val;
      this.#updateModeClass();
      if ((val === '3d' || val === 'both') && !this.#scene) {
        this.#init3D();
      }
    }
  }

  // ─── Public API (for your 3D layer) ──────────────────────────

  /** Get the Three.js Scene. Creates it if needed. */
  getScene() {
    if (!this.#scene) this.#init3D();
    return this.#scene;
  }

  /** Get the Three.js PerspectiveCamera. */
  getCamera() {
    if (!this.#camera) this.#init3D();
    return this.#camera;
  }

  /** Get the Three.js WebGLRenderer. */
  getRenderer() {
    if (!this.#renderer) this.#init3D();
    return this.#renderer;
  }

  /** Get the Three.js canvas container element. */
  getViewport() {
    return this.#viewport;
  }

  /** Get latest tokenization result. */
  getTokenData() {
    return this.#lastResult;
  }

  /** Subscribe to token updates. Callback receives (result, text). */
  onTokenUpdate(fn) {
    this.#tokenListeners.add(fn);
    return () => this.#tokenListeners.delete(fn);
  }

  /** Get the bridge for direct WASM access. */
  getBridge() {
    return this.#bridge;
  }

  /** Programmatically set input text. */
  setText(text) {
    if (this.#textarea) {
      this.#textarea.value = text;
      this.#onInput();
    }
  }

  /** Get current input text. */
  getText() {
    return this.#textarea?.value || '';
  }

  // ─── Internal ────────────────────────────────────────────────

  #render() {
    this.#shadow.innerHTML = `
      <style>${STYLE}</style>
      <div class="frame mode-${this.#mode}">
        <div class="header">
          <span>TOKEN.VIZ</span>
          <select class="vocab-select"></select>
          <span class="count">0 tokens</span>
        </div>
        <div class="input-area">
          <textarea
            spellcheck="false"
            placeholder="${this.getAttribute('placeholder') || 'Start typing to see tokens...'}"
          ></textarea>
          <div class="chips-overlay"></div>
        </div>
        <div class="viewport-3d"></div>
      </div>
    `;

    this.#textarea = this.#shadow.querySelector('textarea');
    this.#chipsOverlay = this.#shadow.querySelector('.chips-overlay');
    this.#viewport = this.#shadow.querySelector('.viewport-3d');
    this.#countEl = this.#shadow.querySelector('.count');
    this.#vocabSelect = this.#shadow.querySelector('.vocab-select');

    this.#textarea.addEventListener('input', () => this.#onInput());
    this.#textarea.addEventListener('scroll', () => this.#syncScroll());
    this.#vocabSelect.addEventListener('change', (e) => this.#onVocabChange(e));
  }

  async #initBridge() {
    try {
      this.#bridge = new TokenizerBridge(this.#vocab);
      await this.#bridge.init();

      // Populate vocab selector
      const vocabs = this.#bridge.listVocabs();
      if (vocabs && this.#vocabSelect) {
        this.#vocabSelect.innerHTML = vocabs
          .map(v => `<option value="${v}" ${v === this.#vocab ? 'selected' : ''}>${v}</option>`)
          .join('');
      }

      this.dispatchEvent(new CustomEvent('ready', { bubbles: true }));

      // Init 3D if mode requires it
      if (this.#mode === '3d' || this.#mode === 'both') {
        this.#init3D();
      }

      // Tokenize any existing content
      if (this.#textarea?.value) {
        this.#onInput();
      }
    } catch (err) {
      console.error('[token-viz] Failed to init WASM bridge:', err);
    }
  }

  #onInput() {
    clearTimeout(this.#debounceTimer);
    // Debounce at ~16ms (one frame) for smooth typing
    this.#debounceTimer = setTimeout(() => this.#retokenize(), 16);
  }

  #retokenize() {
    if (!this.#bridge?.ready) return;

    const text = this.#textarea?.value || '';
    const result = this.#bridge.tokenize(text);
    this.#lastResult = result;

    // Update chip overlay
    this.#renderChips(result.tokens);

    // Update count
    if (this.#countEl) {
      this.#countEl.textContent = `${result.total_tokens} token${result.total_tokens !== 1 ? 's' : ''}`;
    }

    // Notify listeners
    const detail = { ...result, text };
    this.dispatchEvent(new CustomEvent('tokenize', { detail, bubbles: true }));
    for (const fn of this.#tokenListeners) {
      try { fn(result, text); } catch (e) { console.error(e); }
    }
  }

  #renderChips(tokens) {
    if (!this.#chipsOverlay) return;

    const frag = document.createDocumentFragment();

    for (const token of tokens) {
      const span = document.createElement('span');
      span.className = `token-chip ${token.category}`;
      span.textContent = token.text;

      const [r, g, b] = token.color;
      span.style.setProperty('--chip-color', `rgba(${r}, ${g}, ${b}, 0.5)`);
      span.style.setProperty('--chip-bg', `rgba(${r}, ${g}, ${b}, 0.08)`);
      // Rarer tokens glow brighter
      if (token.weight > 0.5) {
        span.style.setProperty('--chip-bg', `rgba(${r}, ${g}, ${b}, ${0.08 + token.weight * 0.12})`);
      }

      frag.appendChild(span);
    }

    this.#chipsOverlay.innerHTML = '';
    this.#chipsOverlay.appendChild(frag);
  }

  #syncScroll() {
    if (this.#chipsOverlay && this.#textarea) {
      this.#chipsOverlay.scrollTop = this.#textarea.scrollTop;
    }
  }

  #onVocabChange(e) {
    const vocabId = e.target.value;
    this.#vocab = vocabId;
    if (this.#bridge?.ready) {
      this.#bridge.setVocab(vocabId);
      this.#bridge.reset();
      this.#retokenize();
    }
    this.dispatchEvent(new CustomEvent('vocab-change', { detail: { vocabId }, bubbles: true }));
  }

  #updateModeClass() {
    const frame = this.#shadow.querySelector('.frame');
    if (frame) {
      frame.className = `frame mode-${this.#mode}`;
    }
  }

  /**
   * Initialize Three.js scene for the 3D viewport.
   * This creates the bare scene/camera/renderer — YOUR code fills it
   * by calling getScene() and adding objects.
   */
  async #init3D() {
    if (this.#scene) return;
    if (!this.#viewport) return;

    try {
      const THREE = await import('three');

      this.#scene = new THREE.Scene();
      this.#scene.background = null; // Transparent — composites over frost glass

      const rect = this.#viewport.getBoundingClientRect();
      const w = rect.width || 640;
      const h = rect.height || 360;

      this.#camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);
      this.#camera.position.set(0, 0, 100);

      this.#renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,          // Transparent background — KEY for desktop compositing
        premultipliedAlpha: false,
      });
      this.#renderer.setSize(w, h);
      this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.#renderer.setClearColor(0x000000, 0); // Fully transparent

      this.#viewport.appendChild(this.#renderer.domElement);

      // Resize observer
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.#camera.aspect = width / height;
            this.#camera.updateProjectionMatrix();
            this.#renderer.setSize(width, height);
          }
        }
      });
      ro.observe(this.#viewport);

      // Start render loop
      const animate = () => {
        this.#animFrameId = requestAnimationFrame(animate);
        this.#renderer.render(this.#scene, this.#camera);
      };
      animate();
    } catch (err) {
      console.warn('[token-viz] Three.js not available, 3D mode disabled:', err.message);
    }
  }

  #dispose() {
    clearTimeout(this.#debounceTimer);

    if (this.#animFrameId) {
      cancelAnimationFrame(this.#animFrameId);
    }
    if (this.#renderer) {
      this.#renderer.dispose();
    }
    if (this.#bridge) {
      this.#bridge.dispose();
    }
    this.#tokenListeners.clear();
  }
}

// Register the custom element
if (!customElements.get('token-viz')) {
  customElements.define('token-viz', TokenVizElement);
}

export default TokenVizElement;
