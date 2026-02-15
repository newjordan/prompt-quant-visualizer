//! WASM bindings for prompt-quant tokenizer.
//!
//! Thin layer exposing the Rust core to JavaScript via wasm-bindgen.
//! Designed for <token-viz> web component consumption.

use prompt_quant_core::{TokenCategory, TokenColorMap, VocabId, VocabRegistry};
use wasm_bindgen::prelude::*;

/// Initialize the WASM module (call once on load).
#[wasm_bindgen(js_name = init)]
pub fn init() {
    // Force global registry initialization
    let _ = VocabRegistry::global();
}

/// List available vocabulary IDs.
#[wasm_bindgen(js_name = listVocabs)]
pub fn list_vocabs() -> JsValue {
    let reg = VocabRegistry::global();
    let vocabs: Vec<String> = reg
        .available()
        .iter()
        .map(|v| v.as_str().to_string())
        .collect();
    serde_wasm_bindgen::to_value(&vocabs).unwrap_or(JsValue::NULL)
}

/// Get info about a vocabulary.
#[wasm_bindgen(js_name = vocabInfo)]
pub fn vocab_info(vocab_id: &str) -> JsValue {
    let reg = VocabRegistry::global();
    let id = VocabId::new(vocab_id);
    let info = reg.info(&id);
    serde_wasm_bindgen::to_value(&info).unwrap_or(JsValue::NULL)
}

/// One-shot tokenize: takes text + vocab ID, returns full TokenizeResult as JSON-compatible JS object.
#[wasm_bindgen(js_name = tokenize)]
pub fn tokenize(text: &str, vocab_id: &str) -> JsValue {
    let id = VocabId::new(vocab_id);
    let result = prompt_quant_core::tokenize(text, &id);
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}

/// Stateful incremental tokenizer for real-time keystroke use.
/// Holds internal state between calls for efficient diff-based updates.
#[wasm_bindgen]
pub struct WasmIncrementalTokenizer {
    // We can't hold a reference to the global registry's tokenizer across WASM calls
    // easily, so we store the vocab_id and do a lookup each time.
    // The cost is negligible compared to the tokenization itself.
    vocab_id: String,
    last_input: String,
    last_result_json: String,
}

#[wasm_bindgen]
impl WasmIncrementalTokenizer {
    /// Create a new incremental tokenizer for a given vocabulary.
    #[wasm_bindgen(constructor)]
    pub fn new(vocab_id: &str) -> Self {
        Self {
            vocab_id: vocab_id.to_string(),
            last_input: String::new(),
            last_result_json: String::new(),
        }
    }

    /// Update with new input text. Returns the tokenization result.
    /// Internally caches to avoid redundant work on identical inputs.
    pub fn update(&mut self, input: &str) -> JsValue {
        if input == self.last_input && !self.last_result_json.is_empty() {
            // Parse cached JSON back to JsValue
            if let Ok(cached) = serde_json::from_str::<serde_json::Value>(&self.last_result_json) {
                return serde_wasm_bindgen::to_value(&cached).unwrap_or(JsValue::NULL);
            }
        }

        let id = VocabId::new(&self.vocab_id);
        let result = prompt_quant_core::tokenize(input, &id);

        // Cache the result
        self.last_input = input.to_string();
        self.last_result_json = serde_json::to_string(&result).unwrap_or_default();

        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    /// Switch to a different vocabulary. Clears cached state.
    #[wasm_bindgen(js_name = setVocab)]
    pub fn set_vocab(&mut self, vocab_id: &str) {
        self.vocab_id = vocab_id.to_string();
        self.last_input.clear();
        self.last_result_json.clear();
    }

    /// Get the current vocabulary ID.
    #[wasm_bindgen(js_name = getVocab)]
    pub fn get_vocab(&self) -> String {
        self.vocab_id.clone()
    }

    /// Reset internal state (forces full re-tokenization on next update).
    pub fn reset(&mut self) {
        self.last_input.clear();
        self.last_result_json.clear();
    }
}

/// Convenience: get the category name for a token (for CSS class mapping).
#[wasm_bindgen(js_name = tokenCategory)]
pub fn token_category(token_id: u32, token_text: &str) -> String {
    let color_map = TokenColorMap::default();
    let cat = color_map.categorize(token_id, token_text);
    format!("{:?}", cat).to_lowercase()
}

/// Convenience: get the RGB color for a category name.
#[wasm_bindgen(js_name = categoryColor)]
pub fn category_color(category: &str) -> JsValue {
    let color_map = TokenColorMap::default();
    let cat = match category {
        "whitespace" => TokenCategory::Whitespace,
        "punctuation" => TokenCategory::Punctuation,
        "common_word" | "commonword" => TokenCategory::CommonWord,
        "word" => TokenCategory::Word,
        "numeric" => TokenCategory::Numeric,
        "code" => TokenCategory::Code,
        "special" => TokenCategory::Special,
        "fragment" => TokenCategory::Fragment,
        _ => TokenCategory::Word,
    };
    let color = color_map.color_for(&cat);
    serde_wasm_bindgen::to_value(&color).unwrap_or(JsValue::NULL)
}
