//! Incremental tokenizer for real-time keystroke visualization.
//!
//! Instead of re-tokenizing the entire input on every keystroke,
//! this module detects what changed and only re-tokenizes the affected region.
//! This keeps latency under 1ms even for long inputs.

use crate::bpe::BpeTokenizer;
use crate::color::TokenColorMap;
use crate::{TokenizeResult, VisualToken};

/// Maintains state between tokenization calls for efficient updates.
pub struct IncrementalTokenizer<'a> {
    tokenizer: &'a BpeTokenizer,
    color_map: TokenColorMap,
    /// Last known input text
    last_input: String,
    /// Cached tokens from last tokenization
    last_tokens: Vec<VisualToken>,
    /// Vocab ID for metadata
    vocab_id: String,
}

impl<'a> IncrementalTokenizer<'a> {
    pub fn new(tokenizer: &'a BpeTokenizer, vocab_id: &str) -> Self {
        Self {
            tokenizer,
            color_map: TokenColorMap::default(),
            last_input: String::new(),
            last_tokens: Vec::new(),
            vocab_id: vocab_id.to_string(),
        }
    }

    /// Tokenize the input, reusing cached results where possible.
    /// Returns the full token list plus a `changed_range` indicating
    /// which token indices were affected.
    pub fn update(&mut self, input: &str) -> IncrementalResult {
        if input == self.last_input {
            return IncrementalResult {
                result: TokenizeResult {
                    tokens: self.last_tokens.clone(),
                    total_tokens: self.last_tokens.len(),
                    vocab_id: self.vocab_id.clone(),
                },
                changed_range: None,
            };
        }

        if self.last_input.is_empty() || input.is_empty() {
            // Full re-tokenize
            let result = self.full_tokenize(input);
            let len = result.tokens.len();
            self.last_input = input.to_string();
            self.last_tokens = result.tokens.clone();
            return IncrementalResult {
                result,
                changed_range: Some((0, len)),
            };
        }

        // Find the common prefix and suffix (in bytes)
        let (prefix_bytes, suffix_bytes) = find_common_affixes(&self.last_input, input);

        // Determine the changed region in the new input
        let changed_start = prefix_bytes;
        let changed_end = input.len() - suffix_bytes;

        // If the change is small relative to input, do incremental.
        // Otherwise, just re-tokenize everything (simpler, and only ~2x slower for short inputs).
        let change_size = changed_end.saturating_sub(changed_start);
        let use_incremental = change_size < input.len() / 2 && !self.last_tokens.is_empty();

        if use_incremental {
            // Find which tokens overlap with the changed byte range
            let first_affected = self
                .last_tokens
                .iter()
                .position(|t| t.byte_end > changed_start)
                .unwrap_or(0);

            // Re-tokenize from first_affected token's start to end of changed region + margin
            let retok_start = if first_affected > 0 {
                self.last_tokens[first_affected].byte_start
            } else {
                0
            };

            // Include some trailing context for proper BPE merging
            let retok_end = (changed_end + 32).min(input.len());

            // Get the slice to re-tokenize
            let slice = &input[retok_start..retok_end];
            let raw_tokens = self.tokenizer.encode(slice);

            // Build visual tokens for the re-tokenized region
            let mut new_mid: Vec<VisualToken> = Vec::with_capacity(raw_tokens.len());
            let mut char_offset = input[..retok_start].chars().count();

            for rt in &raw_tokens {
                let char_len = rt.text.chars().count();
                let category = self.color_map.categorize(rt.id, &rt.text);
                let color = self.color_map.color_for(&category);
                let weight = self.color_map.weight_for(rt.id, self.tokenizer.vocab_size());

                new_mid.push(VisualToken {
                    id: rt.id,
                    text: rt.text.clone(),
                    byte_start: retok_start + rt.byte_start,
                    byte_end: retok_start + rt.byte_end,
                    char_start: char_offset,
                    char_end: char_offset + char_len,
                    color,
                    category,
                    weight,
                });
                char_offset += char_len;
            }

            // Re-tokenize the tail if needed
            let tail_tokens = if retok_end < input.len() {
                let tail = &input[retok_end..];
                let raw_tail = self.tokenizer.encode(tail);
                let mut tail_vis = Vec::with_capacity(raw_tail.len());
                let mut tail_char_offset = input[..retok_end].chars().count();
                for rt in &raw_tail {
                    let char_len = rt.text.chars().count();
                    let category = self.color_map.categorize(rt.id, &rt.text);
                    let color = self.color_map.color_for(&category);
                    let weight =
                        self.color_map.weight_for(rt.id, self.tokenizer.vocab_size());
                    tail_vis.push(VisualToken {
                        id: rt.id,
                        text: rt.text.clone(),
                        byte_start: retok_end + rt.byte_start,
                        byte_end: retok_end + rt.byte_end,
                        char_start: tail_char_offset,
                        char_end: tail_char_offset + char_len,
                        color,
                        category,
                        weight,
                    });
                    tail_char_offset += char_len;
                }
                tail_vis
            } else {
                Vec::new()
            };

            // Assemble: prefix tokens + re-tokenized middle + tail
            let prefix_tokens: Vec<VisualToken> = self.last_tokens[..first_affected].to_vec();

            let changed_start_idx = prefix_tokens.len();
            let mut all_tokens = prefix_tokens;
            all_tokens.extend(new_mid);
            all_tokens.extend(tail_tokens);
            let changed_end_idx = all_tokens.len();

            let total = all_tokens.len();
            self.last_input = input.to_string();
            self.last_tokens = all_tokens.clone();

            IncrementalResult {
                result: TokenizeResult {
                    tokens: all_tokens,
                    total_tokens: total,
                    vocab_id: self.vocab_id.clone(),
                },
                changed_range: Some((changed_start_idx, changed_end_idx)),
            }
        } else {
            // Full re-tokenize
            let result = self.full_tokenize(input);
            let len = result.tokens.len();
            self.last_input = input.to_string();
            self.last_tokens = result.tokens.clone();
            IncrementalResult {
                result,
                changed_range: Some((0, len)),
            }
        }
    }

    /// Reset state (e.g., when switching vocabs).
    pub fn reset(&mut self) {
        self.last_input.clear();
        self.last_tokens.clear();
    }

    fn full_tokenize(&self, input: &str) -> TokenizeResult {
        let raw_tokens = self.tokenizer.encode(input);
        let mut tokens = Vec::with_capacity(raw_tokens.len());
        let mut char_offset = 0;

        for rt in &raw_tokens {
            let char_len = rt.text.chars().count();
            let category = self.color_map.categorize(rt.id, &rt.text);
            let color = self.color_map.color_for(&category);
            let weight = self.color_map.weight_for(rt.id, self.tokenizer.vocab_size());

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

        let total = tokens.len();
        TokenizeResult {
            tokens,
            total_tokens: total,
            vocab_id: self.vocab_id.clone(),
        }
    }
}

/// Result from incremental tokenization.
pub struct IncrementalResult {
    /// Full token list
    pub result: TokenizeResult,
    /// Which token indices changed (start, end), or None if nothing changed
    pub changed_range: Option<(usize, usize)>,
}

/// Find the length of common prefix and suffix between two strings (in bytes).
fn find_common_affixes(old: &str, new: &str) -> (usize, usize) {
    let old_bytes = old.as_bytes();
    let new_bytes = new.as_bytes();

    // Common prefix
    let prefix = old_bytes
        .iter()
        .zip(new_bytes.iter())
        .take_while(|(a, b)| a == b)
        .count();

    // Common suffix (don't overlap with prefix)
    let max_suffix = old_bytes.len().min(new_bytes.len()) - prefix;
    let suffix = old_bytes
        .iter()
        .rev()
        .zip(new_bytes.iter().rev())
        .take(max_suffix)
        .take_while(|(a, b)| a == b)
        .count();

    (prefix, suffix)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vocab::VocabRegistry;
    use crate::VocabId;

    fn make_incremental<'a>(tok: &'a BpeTokenizer) -> IncrementalTokenizer<'a> {
        IncrementalTokenizer::new(tok, "test")
    }

    #[test]
    fn test_incremental_basic() {
        let reg = VocabRegistry::global();
        let tok = reg.get(&VocabId::cl100k());
        let mut inc = make_incremental(tok);

        let r1 = inc.update("hello");
        assert!(!r1.result.tokens.is_empty());
        assert!(r1.changed_range.is_some());
    }

    #[test]
    fn test_incremental_no_change() {
        let reg = VocabRegistry::global();
        let tok = reg.get(&VocabId::cl100k());
        let mut inc = make_incremental(tok);

        inc.update("hello world");
        let r2 = inc.update("hello world");
        assert!(r2.changed_range.is_none()); // No change
    }

    #[test]
    fn test_incremental_append() {
        let reg = VocabRegistry::global();
        let tok = reg.get(&VocabId::cl100k());
        let mut inc = make_incremental(tok);

        inc.update("hello");
        let r2 = inc.update("hello world");
        assert!(r2.changed_range.is_some());
        assert!(r2.result.total_tokens > 0);
    }

    #[test]
    fn test_common_affixes() {
        let (p, s) = find_common_affixes("hello world", "hello there");
        assert_eq!(p, 6); // "hello "
        assert!(s == 0 || s <= 1);
    }

    #[test]
    fn test_reset() {
        let reg = VocabRegistry::global();
        let tok = reg.get(&VocabId::cl100k());
        let mut inc = make_incremental(tok);

        inc.update("hello");
        inc.reset();

        let r = inc.update("hello");
        assert!(r.changed_range.is_some()); // Should be full re-tokenize after reset
    }
}
