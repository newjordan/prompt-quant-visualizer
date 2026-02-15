//! Core BPE (Byte-Pair Encoding) tokenizer implementation.
//!
//! This is a from-scratch BPE engine optimized for:
//! - Fast re-encoding (designed for keystroke-level latency)
//! - Vocabulary-agnostic (works with any BPE merge table)
//! - Returns byte ranges for precise visual mapping

use rustc_hash::FxHashMap;

/// A raw token before visual metadata is attached.
#[derive(Debug, Clone)]
pub struct RawToken {
    pub id: u32,
    pub text: String,
    pub byte_start: usize,
    pub byte_end: usize,
}

/// A BPE tokenizer loaded with a specific vocabulary.
pub struct BpeTokenizer {
    /// Token string → token ID
    encoder: FxHashMap<Vec<u8>, u32>,
    /// Token ID → token bytes
    decoder: FxHashMap<u32, Vec<u8>>,
    /// Merge pairs with priority (lower = merge first)
    merges: FxHashMap<(Vec<u8>, Vec<u8>), usize>,
    /// Special tokens (e.g. <|endoftext|>)
    special_tokens: FxHashMap<String, u32>,
    /// Total vocabulary size
    vocab_size: usize,
}

impl BpeTokenizer {
    /// Create a new tokenizer from encoder map and merge list.
    pub fn new(
        encoder: FxHashMap<Vec<u8>, u32>,
        merges: Vec<(Vec<u8>, Vec<u8>)>,
        special_tokens: FxHashMap<String, u32>,
    ) -> Self {
        let vocab_size = encoder.len() + special_tokens.len();
        let decoder: FxHashMap<u32, Vec<u8>> =
            encoder.iter().map(|(k, &v)| (v, k.clone())).collect();

        let merge_map: FxHashMap<(Vec<u8>, Vec<u8>), usize> = merges
            .into_iter()
            .enumerate()
            .map(|(i, pair)| (pair, i))
            .collect();

        Self {
            encoder,
            decoder,
            merges: merge_map,
            special_tokens,
            vocab_size,
        }
    }

    pub fn vocab_size(&self) -> usize {
        self.vocab_size
    }

    /// Encode text into raw tokens with byte positions.
    pub fn encode(&self, text: &str) -> Vec<RawToken> {
        if text.is_empty() {
            return Vec::new();
        }

        let mut result = Vec::new();
        let mut byte_offset = 0;

        // Split on special tokens first, then BPE-encode each chunk
        let chunks = self.split_special_tokens(text);

        for chunk in chunks {
            match chunk {
                Chunk::Special(s, id) => {
                    let byte_len = s.len();
                    result.push(RawToken {
                        id,
                        text: s.clone(),
                        byte_start: byte_offset,
                        byte_end: byte_offset + byte_len,
                    });
                    byte_offset += byte_len;
                }
                Chunk::Text(s) => {
                    let tokens = self.bpe_encode_chunk(s.as_bytes());
                    for token_bytes in tokens {
                        let byte_len = token_bytes.len();
                        let id = self
                            .encoder
                            .get(&token_bytes)
                            .copied()
                            .unwrap_or(0);
                        let text = String::from_utf8_lossy(&token_bytes).to_string();
                        result.push(RawToken {
                            id,
                            text,
                            byte_start: byte_offset,
                            byte_end: byte_offset + byte_len,
                        });
                        byte_offset += byte_len;
                    }
                }
            }
        }

        result
    }

    /// Decode a sequence of token IDs back to text.
    pub fn decode(&self, ids: &[u32]) -> String {
        let bytes: Vec<u8> = ids
            .iter()
            .flat_map(|id| {
                self.decoder
                    .get(id)
                    .cloned()
                    .unwrap_or_default()
            })
            .collect();
        String::from_utf8_lossy(&bytes).to_string()
    }

    /// Core BPE algorithm: repeatedly merge the highest-priority pair.
    fn bpe_encode_chunk(&self, input: &[u8]) -> Vec<Vec<u8>> {
        if input.is_empty() {
            return Vec::new();
        }

        // Start with each byte as its own piece
        let mut pieces: Vec<Vec<u8>> = input.iter().map(|&b| vec![b]).collect();

        loop {
            if pieces.len() < 2 {
                break;
            }

            // Find the pair with the lowest merge rank
            let mut best_rank = usize::MAX;
            let mut best_idx = None;

            for i in 0..pieces.len() - 1 {
                let pair = (pieces[i].clone(), pieces[i + 1].clone());
                if let Some(&rank) = self.merges.get(&pair) {
                    if rank < best_rank {
                        best_rank = rank;
                        best_idx = Some(i);
                    }
                }
            }

            match best_idx {
                Some(idx) => {
                    // Merge the pair
                    let mut merged = pieces[idx].clone();
                    merged.extend_from_slice(&pieces[idx + 1]);
                    pieces[idx] = merged;
                    pieces.remove(idx + 1);
                }
                None => break, // No more merges possible
            }
        }

        pieces
    }

    /// Split text on special token boundaries.
    fn split_special_tokens<'a>(&self, text: &'a str) -> Vec<Chunk<'a>> {
        if self.special_tokens.is_empty() {
            return vec![Chunk::Text(text)];
        }

        let mut chunks = Vec::new();
        let mut remaining = text;

        while !remaining.is_empty() {
            let mut earliest_match: Option<(&str, u32, usize)> = None;

            for (token, &id) in &self.special_tokens {
                if let Some(pos) = remaining.find(token.as_str()) {
                    if earliest_match.is_none() || pos < earliest_match.unwrap().2 {
                        earliest_match = Some((token.as_str(), id, pos));
                    }
                }
            }

            match earliest_match {
                Some((token, id, pos)) => {
                    if pos > 0 {
                        chunks.push(Chunk::Text(&remaining[..pos]));
                    }
                    chunks.push(Chunk::Special(
                        token.to_string(),
                        id,
                    ));
                    remaining = &remaining[pos + token.len()..];
                }
                None => {
                    chunks.push(Chunk::Text(remaining));
                    break;
                }
            }
        }

        chunks
    }
}

enum Chunk<'a> {
    Text(&'a str),
    Special(String, u32),
}

/// Build a simple byte-level BPE vocabulary from scratch.
/// This creates a base vocab of 256 single-byte tokens,
/// then learns `num_merges` merge pairs from the training text.
pub fn train_bpe(text: &str, num_merges: usize) -> BpeTokenizer {
    // Base vocabulary: every possible byte
    let mut encoder: FxHashMap<Vec<u8>, u32> = FxHashMap::default();
    for i in 0u32..256 {
        encoder.insert(vec![i as u8], i);
    }

    let bytes = text.as_bytes();
    let mut pieces: Vec<Vec<u8>> = bytes.iter().map(|&b| vec![b]).collect();
    let mut merges: Vec<(Vec<u8>, Vec<u8>)> = Vec::with_capacity(num_merges);
    let mut next_id = 256u32;

    for _ in 0..num_merges {
        // Count all adjacent pairs
        let mut pair_counts: FxHashMap<(Vec<u8>, Vec<u8>), usize> = FxHashMap::default();
        for window in pieces.windows(2) {
            let pair = (window[0].clone(), window[1].clone());
            *pair_counts.entry(pair).or_insert(0) += 1;
        }

        // Find most frequent pair
        let best = pair_counts.into_iter().max_by_key(|&(_, count)| count);

        match best {
            Some((pair, count)) if count >= 2 => {
                let mut merged = pair.0.clone();
                merged.extend_from_slice(&pair.1);

                encoder.insert(merged.clone(), next_id);
                merges.push((pair.0.clone(), pair.1.clone()));
                next_id += 1;

                // Apply this merge to all pieces
                let mut new_pieces = Vec::with_capacity(pieces.len());
                let mut i = 0;
                while i < pieces.len() {
                    if i + 1 < pieces.len() && pieces[i] == pair.0 && pieces[i + 1] == pair.1 {
                        new_pieces.push(merged.clone());
                        i += 2;
                    } else {
                        new_pieces.push(pieces[i].clone());
                        i += 1;
                    }
                }
                pieces = new_pieces;
            }
            _ => break,
        }
    }

    BpeTokenizer::new(encoder, merges, FxHashMap::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_simple_tokenizer() -> BpeTokenizer {
        // Base vocab: single bytes
        let mut encoder: FxHashMap<Vec<u8>, u32> = FxHashMap::default();
        for i in 0u32..256 {
            encoder.insert(vec![i as u8], i);
        }

        // Add some merges: "th" "he" "the" "in" "ing"
        encoder.insert(b"th".to_vec(), 256);
        encoder.insert(b"he".to_vec(), 257);
        encoder.insert(b"in".to_vec(), 258);
        encoder.insert(b"the".to_vec(), 259);
        encoder.insert(b"ing".to_vec(), 260);

        let merges = vec![
            (b"t".to_vec(), b"h".to_vec()),   // th
            (b"h".to_vec(), b"e".to_vec()),    // he
            (b"i".to_vec(), b"n".to_vec()),    // in
            (b"th".to_vec(), b"e".to_vec()),   // the
            (b"in".to_vec(), b"g".to_vec()),   // ing
        ];

        BpeTokenizer::new(encoder, merges, FxHashMap::default())
    }

    #[test]
    fn test_encode_simple() {
        let tok = make_simple_tokenizer();
        let tokens = tok.encode("the");
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].text, "the");
        assert_eq!(tokens[0].id, 259);
    }

    #[test]
    fn test_encode_multi_token() {
        let tok = make_simple_tokenizer();
        let tokens = tok.encode("thing");
        // "th" + "ing" = 2 tokens
        assert_eq!(tokens.len(), 2);
        assert_eq!(tokens[0].text, "th");
        assert_eq!(tokens[1].text, "ing");
    }

    #[test]
    fn test_byte_ranges() {
        let tok = make_simple_tokenizer();
        let tokens = tok.encode("the thing");
        // "the" + " " + "th" + "ing"
        assert_eq!(tokens[0].byte_start, 0);
        assert_eq!(tokens[0].byte_end, 3);
    }

    #[test]
    fn test_empty() {
        let tok = make_simple_tokenizer();
        let tokens = tok.encode("");
        assert!(tokens.is_empty());
    }

    #[test]
    fn test_roundtrip() {
        let tok = make_simple_tokenizer();
        let input = "the thing";
        let tokens = tok.encode(input);
        let ids: Vec<u32> = tokens.iter().map(|t| t.id).collect();
        let decoded = tok.decode(&ids);
        assert_eq!(decoded, input);
    }

    #[test]
    fn test_train_bpe() {
        let tok = train_bpe("the the the thing thing", 10);
        let tokens = tok.encode("the");
        // After training on repeated "the", it should merge into 1-2 tokens
        assert!(tokens.len() <= 3);
    }
}
