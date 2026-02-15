//! prompt-quant-core: BPE tokenizer engine with multi-vocab support
//!
//! Designed for real-time keystroke tokenization via WASM.
//! The core provides incremental tokenization, swappable vocabularies,
//! and token metadata (color hints, categories) for visualization.

pub mod bpe;
pub mod color;
pub mod incremental;
pub mod vocab;

pub use bpe::BpeTokenizer;
pub use color::{TokenCategory, TokenColorMap};
pub use incremental::IncrementalTokenizer;
pub use vocab::{VocabId, VocabRegistry};

use serde::{Deserialize, Serialize};

/// A single token with all metadata needed for visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualToken {
    /// Token ID in the vocabulary
    pub id: u32,
    /// The decoded text this token represents
    pub text: String,
    /// Byte offset in the original input (start)
    pub byte_start: usize,
    /// Byte offset in the original input (end)
    pub byte_end: usize,
    /// Character offset in the original input (start)
    pub char_start: usize,
    /// Character offset in the original input (end)
    pub char_end: usize,
    /// Suggested color as [r, g, b] 0-255
    pub color: [u8; 3],
    /// Category classification for grouping
    pub category: TokenCategory,
    /// Normalized "weight" 0.0-1.0 (frequency-based rarity)
    pub weight: f32,
}

/// Result of tokenizing a complete input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenizeResult {
    pub tokens: Vec<VisualToken>,
    pub total_tokens: usize,
    pub vocab_id: String,
}

/// Top-level convenience: tokenize text with a given vocab.
pub fn tokenize(text: &str, vocab: &VocabId) -> TokenizeResult {
    let registry = VocabRegistry::global();
    let tokenizer = registry.get(vocab);
    let color_map = TokenColorMap::default();

    let raw_tokens = tokenizer.encode(text);
    let mut tokens = Vec::with_capacity(raw_tokens.len());

    let mut char_offset = 0;
    for rt in &raw_tokens {
        let char_len = rt.text.chars().count();
        let category = color_map.categorize(rt.id, &rt.text);
        let color = color_map.color_for(&category);
        let weight = color_map.weight_for(rt.id, tokenizer.vocab_size());

        tokens.push(VisualToken {
            id: rt.id,
            text: rt.text.clone(),
            byte_start: rt.byte_start,
            byte_end: rt.byte_end,
            char_start: char_offset,
            char_end: char_offset + char_len,
            color,
            category,
            weight,
        });
        char_offset += char_len;
    }

    let total_tokens = tokens.len();
    TokenizeResult {
        tokens,
        total_tokens,
        vocab_id: vocab.as_str().to_string(),
    }
}
