/**
 * JS ↔ WASM bridge for prompt-quant tokenizer.
 *
 * Handles async WASM initialization, provides a clean API,
 * and manages the incremental tokenizer lifecycle.
 *
 * Usage:
 *   import { TokenizerBridge } from './bridge.js';
 *   const bridge = new TokenizerBridge();
 *   await bridge.init();
 *   const result = bridge.tokenize('hello world');
 */

let wasmModule = null;
let wasmReady = false;
let initPromise = null;

/**
 * Load and initialize the WASM module (singleton).
 * Safe to call multiple times — returns cached promise.
 */
async function loadWasm() {
  if (wasmReady) return wasmModule;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Dynamic import — works with Vite, bundlers, and raw ES modules
    const wasm = await import('../../pkg/prompt_quant_wasm.js');

    // Initialize the WASM binary
    const wasmUrl = new URL('../../pkg/prompt_quant_wasm_bg.wasm', import.meta.url);
    await wasm.default(wasmUrl);

    // Initialize the Rust side (loads vocabularies)
    wasm.init();

    wasmModule = wasm;
    wasmReady = true;
    return wasm;
  })();

  return initPromise;
}


/**
 * Main bridge class. Drop-in API for tokenizing from JS.
 */
export class TokenizerBridge {
  #wasm = null;
  #incremental = null;
  #vocabId = 'cl100k_base';
  #ready = false;

  constructor(vocabId = 'cl100k_base') {
    this.#vocabId = vocabId;
  }

  /** Initialize the WASM module. Must be called before tokenize(). */
  async init() {
    this.#wasm = await loadWasm();
    this.#incremental = new this.#wasm.WasmIncrementalTokenizer(this.#vocabId);
    this.#ready = true;
    return this;
  }

  /** Whether the bridge is ready to tokenize. */
  get ready() {
    return this.#ready;
  }

  /** Current vocabulary ID. */
  get vocabId() {
    return this.#vocabId;
  }

  /**
   * Tokenize text. Returns { tokens, total_tokens, vocab_id }.
   * Uses incremental tokenizer for efficient keystroke updates.
   *
   * Each token: { id, text, byte_start, byte_end, char_start, char_end, color, category, weight }
   */
  tokenize(text) {
    if (!this.#ready) {
      throw new Error('TokenizerBridge not initialized. Call init() first.');
    }
    return this.#incremental.update(text);
  }

  /**
   * One-shot tokenize (no caching). Useful for comparing vocabs.
   */
  tokenizeOneShot(text, vocabId = this.#vocabId) {
    if (!this.#ready) {
      throw new Error('TokenizerBridge not initialized. Call init() first.');
    }
    return this.#wasm.tokenize(text, vocabId);
  }

  /**
   * Switch vocabulary. Resets incremental state.
   */
  setVocab(vocabId) {
    this.#vocabId = vocabId;
    if (this.#incremental) {
      this.#incremental.setVocab(vocabId);
    }
  }

  /**
   * List available vocabulary IDs.
   */
  listVocabs() {
    if (!this.#ready) return [];
    return this.#wasm.listVocabs();
  }

  /**
   * Get info about a vocabulary.
   * Returns { id, name, description, vocab_size }
   */
  vocabInfo(vocabId = this.#vocabId) {
    if (!this.#ready) return null;
    return this.#wasm.vocabInfo(vocabId);
  }

  /**
   * Get the category name for a token.
   */
  tokenCategory(tokenId, tokenText) {
    if (!this.#ready) return 'word';
    return this.#wasm.tokenCategory(tokenId, tokenText);
  }

  /**
   * Get RGB color for a category.
   * Returns [r, g, b] array.
   */
  categoryColor(category) {
    if (!this.#ready) return [125, 244, 255];
    return this.#wasm.categoryColor(category);
  }

  /**
   * Reset incremental tokenizer state.
   * Forces full re-tokenization on next call.
   */
  reset() {
    if (this.#incremental) {
      this.#incremental.reset();
    }
  }

  /**
   * Clean up WASM resources.
   */
  dispose() {
    if (this.#incremental) {
      this.#incremental.free();
      this.#incremental = null;
    }
    this.#ready = false;
  }
}

export { loadWasm };
export default TokenizerBridge;
