//! Multi-vocabulary registry.
//!
//! Supports loading and switching between different BPE vocabularies
//! (cl100k_base, o200k_base, p50k_base, or custom-trained).

use crate::bpe::BpeTokenizer;
use rustc_hash::FxHashMap;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

/// Identifier for a vocabulary.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct VocabId(String);

impl VocabId {
    pub fn new(name: &str) -> Self {
        Self(name.to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// cl100k_base: used by GPT-4, GPT-3.5-turbo
    pub fn cl100k() -> Self {
        Self::new("cl100k_base")
    }

    /// o200k_base: used by GPT-4o
    pub fn o200k() -> Self {
        Self::new("o200k_base")
    }

    /// p50k_base: used by older models (text-davinci-003, etc.)
    pub fn p50k() -> Self {
        Self::new("p50k_base")
    }
}

/// Registry that holds loaded vocabularies.
pub struct VocabRegistry {
    tokenizers: FxHashMap<VocabId, BpeTokenizer>,
    default_id: VocabId,
}

static GLOBAL_REGISTRY: OnceLock<VocabRegistry> = OnceLock::new();

impl VocabRegistry {
    /// Get or initialize the global registry with built-in vocabularies.
    pub fn global() -> &'static VocabRegistry {
        GLOBAL_REGISTRY.get_or_init(|| {
            let mut registry = VocabRegistry {
                tokenizers: FxHashMap::default(),
                default_id: VocabId::cl100k(),
            };
            registry.register_builtins();
            registry
        })
    }

    /// Create an empty registry (for testing or custom use).
    pub fn new(default_id: VocabId) -> Self {
        Self {
            tokenizers: FxHashMap::default(),
            default_id,
        }
    }

    /// Register a tokenizer under a given vocab ID.
    pub fn register(&mut self, id: VocabId, tokenizer: BpeTokenizer) {
        self.tokenizers.insert(id, tokenizer);
    }

    /// Get a tokenizer by vocab ID, falling back to default.
    pub fn get(&self, id: &VocabId) -> &BpeTokenizer {
        self.tokenizers
            .get(id)
            .or_else(|| self.tokenizers.get(&self.default_id))
            .expect("no tokenizer registered")
    }

    /// List available vocabulary IDs.
    pub fn available(&self) -> Vec<&VocabId> {
        self.tokenizers.keys().collect()
    }

    /// Register the built-in vocabularies.
    ///
    /// These are simplified byte-level BPE tokenizers with common English merges.
    /// For production use, load real vocab files via `register_from_json`.
    fn register_builtins(&mut self) {
        // cl100k_base approximation
        self.register(VocabId::cl100k(), build_cl100k_approx());
        // o200k_base approximation
        self.register(VocabId::o200k(), build_o200k_approx());
        // p50k_base approximation
        self.register(VocabId::p50k(), build_p50k_approx());
    }
}

/// Vocabulary metadata for UI display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub vocab_size: usize,
}

impl VocabRegistry {
    pub fn info(&self, id: &VocabId) -> VocabInfo {
        let tokenizer = self.get(id);
        VocabInfo {
            id: id.as_str().to_string(),
            name: match id.as_str() {
                "cl100k_base" => "cl100k_base".to_string(),
                "o200k_base" => "o200k_base".to_string(),
                "p50k_base" => "p50k_base".to_string(),
                other => other.to_string(),
            },
            description: match id.as_str() {
                "cl100k_base" => "GPT-4 / GPT-3.5-turbo tokenizer".to_string(),
                "o200k_base" => "GPT-4o tokenizer".to_string(),
                "p50k_base" => "Legacy (text-davinci) tokenizer".to_string(),
                _ => "Custom vocabulary".to_string(),
            },
            vocab_size: tokenizer.vocab_size(),
        }
    }
}

/// Build a cl100k_base-like tokenizer with common English BPE merges.
/// This is an approximation—for exact results, load the real tiktoken data.
fn build_cl100k_approx() -> BpeTokenizer {
    build_english_bpe_tokenizer(COMMON_MERGES_EXTENDED)
}

fn build_o200k_approx() -> BpeTokenizer {
    // o200k uses a larger vocab but similar merge strategy
    build_english_bpe_tokenizer(COMMON_MERGES_EXTENDED)
}

fn build_p50k_approx() -> BpeTokenizer {
    // p50k uses fewer merges
    build_english_bpe_tokenizer(COMMON_MERGES_BASE)
}

fn build_english_bpe_tokenizer(merge_defs: &[(& [u8], &[u8])]) -> BpeTokenizer {
    let mut encoder: FxHashMap<Vec<u8>, u32> = FxHashMap::default();

    // Base: all 256 byte values
    for i in 0u32..256 {
        encoder.insert(vec![i as u8], i);
    }

    let mut merges: Vec<(Vec<u8>, Vec<u8>)> = Vec::new();
    let mut next_id = 256u32;

    for &(a, b) in merge_defs {
        let mut merged = a.to_vec();
        merged.extend_from_slice(b);
        encoder.insert(merged, next_id);
        merges.push((a.to_vec(), b.to_vec()));
        next_id += 1;
    }

    let mut special = FxHashMap::default();
    special.insert("<|endoftext|>".to_string(), next_id);

    BpeTokenizer::new(encoder, merges, special)
}

// Common English BPE merges (ordered by frequency in typical English text).
// These produce a reasonable approximation of how real tokenizers segment text.
const COMMON_MERGES_BASE: &[(&[u8], &[u8])] = &[
    // Whitespace + letter combos (very high frequency)
    (b" ", b"t"),   // " t"
    (b" ", b"a"),   // " a"
    (b" ", b"s"),   // " s"
    (b" ", b"o"),   // " o"
    (b" ", b"i"),   // " i"
    (b" ", b"c"),   // " c"
    (b" ", b"w"),   // " w"
    (b" ", b"h"),   // " h"
    (b" ", b"m"),   // " m"
    (b" ", b"d"),   // " d"
    (b" ", b"f"),   // " f"
    (b" ", b"b"),   // " b"
    (b" ", b"p"),   // " p"
    (b" ", b"n"),   // " n"
    (b" ", b"e"),   // " e"
    (b" ", b"r"),   // " r"
    (b" ", b"l"),   // " l"
    (b" ", b"g"),   // " g"
    // Common 2-char merges
    (b"t", b"h"),   // th
    (b"h", b"e"),   // he
    (b"i", b"n"),   // in
    (b"e", b"r"),   // er
    (b"a", b"n"),   // an
    (b"r", b"e"),   // re
    (b"o", b"n"),   // on
    (b"e", b"n"),   // en
    (b"a", b"t"),   // at
    (b"o", b"r"),   // or
    (b"e", b"s"),   // es
    (b"t", b"e"),   // te
    (b"e", b"d"),   // ed
    (b"i", b"t"),   // it
    (b"o", b"u"),   // ou
    (b"a", b"l"),   // al
    (b"i", b"s"),   // is
    (b"s", b"t"),   // st
    (b"a", b"r"),   // ar
    (b"n", b"d"),   // nd
    // Common 3+ char merges
    (b"th", b"e"),  // the
    (b"in", b"g"),  // ing
    (b"an", b"d"),  // and
    (b"er", b"e"),  // ere
    (b"th", b"a"),  // tha
    (b"en", b"t"),  // ent
    (b"ti", b"on"), // tion (needs intermediate)
    (b"at", b"e"),  // ate
    (b"al", b"l"),  // all
    (b"ou", b"r"),  // our
];

const COMMON_MERGES_EXTENDED: &[(&[u8], &[u8])] = &[
    // All base merges
    (b" ", b"t"),
    (b" ", b"a"),
    (b" ", b"s"),
    (b" ", b"o"),
    (b" ", b"i"),
    (b" ", b"c"),
    (b" ", b"w"),
    (b" ", b"h"),
    (b" ", b"m"),
    (b" ", b"d"),
    (b" ", b"f"),
    (b" ", b"b"),
    (b" ", b"p"),
    (b" ", b"n"),
    (b" ", b"e"),
    (b" ", b"r"),
    (b" ", b"l"),
    (b" ", b"g"),
    (b"t", b"h"),
    (b"h", b"e"),
    (b"i", b"n"),
    (b"e", b"r"),
    (b"a", b"n"),
    (b"r", b"e"),
    (b"o", b"n"),
    (b"e", b"n"),
    (b"a", b"t"),
    (b"o", b"r"),
    (b"e", b"s"),
    (b"t", b"e"),
    (b"e", b"d"),
    (b"i", b"t"),
    (b"o", b"u"),
    (b"a", b"l"),
    (b"i", b"s"),
    (b"s", b"t"),
    (b"a", b"r"),
    (b"n", b"d"),
    (b"th", b"e"),
    (b"in", b"g"),
    (b"an", b"d"),
    (b"er", b"e"),
    (b"th", b"a"),
    (b"en", b"t"),
    (b"at", b"e"),
    (b"al", b"l"),
    (b"ou", b"r"),
    // Extended merges for cl100k/o200k
    (b" th", b"e"),   // " the"
    (b" ", b"th"),     // " th"
    (b" th", b"at"),   // " that"  (needs " th" first)
    (b"i", b"ng"),     // potential alternate
    (b"l", b"e"),      // le
    (b"s", b"e"),      // se
    (b"o", b"f"),      // of
    (b" ", b"of"),     // " of" (needs "of" first)
    (b"i", b"on"),     // ion
    (b"t", b"ion"),    // tion
    (b"c", b"h"),      // ch
    (b"l", b"y"),      // ly
    (b"m", b"e"),      // me
    (b"i", b"l"),      // il
    (b"c", b"e"),      // ce
    (b"v", b"e"),      // ve
    (b"n", b"e"),      // ne
    (b" w", b"ith"),   // needs parts
    (b"w", b"i"),      // wi
    (b"i", b"th"),     // ith (needs parts)
    (b" ", b"in"),     // " in"
    (b" ", b"is"),     // " is"
    (b" ", b"it"),     // " it"
    (b" ", b"an"),     // " an"
    (b" ", b"on"),     // " on"
    (b" ", b"or"),     // " or"
    (b" ", b"at"),     // " at"
    (b" ", b"re"),     // " re"
    (b" ", b"al"),     // " al"
    (b" ", b"st"),     // " st"
    (b" ", b"en"),     // " en"
    (b" ", b"er"),     // " er"
    (b" ", b"he"),     // " he"
    (b" ", b"to"),     // needs "to"
    (b"t", b"o"),      // to
    (b" ", b"to"),     // " to"
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vocab_registry() {
        let reg = VocabRegistry::global();
        let available = reg.available();
        assert!(available.len() >= 3);
    }

    #[test]
    fn test_cl100k_tokenizes() {
        let reg = VocabRegistry::global();
        let tok = reg.get(&VocabId::cl100k());
        let tokens = tok.encode("the thing");
        assert!(!tokens.is_empty());
    }

    #[test]
    fn test_vocab_switching() {
        let reg = VocabRegistry::global();
        let t1 = reg.get(&VocabId::cl100k());
        let t2 = reg.get(&VocabId::p50k());
        // They may produce different token counts
        let r1 = t1.encode("hello world");
        let r2 = t2.encode("hello world");
        assert!(!r1.is_empty());
        assert!(!r2.is_empty());
    }

    #[test]
    fn test_vocab_info() {
        let reg = VocabRegistry::global();
        let info = reg.info(&VocabId::cl100k());
        assert_eq!(info.id, "cl100k_base");
        assert!(info.vocab_size > 256);
    }
}
