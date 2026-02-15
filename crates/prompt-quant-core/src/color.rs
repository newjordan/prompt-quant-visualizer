//! Token → color and category mapping for visualization.
//!
//! Maps tokens to visual properties based on their content and ID.
//! Categories drive both color and 3D node behavior.

use serde::{Deserialize, Serialize};

/// High-level category for a token, drives visual treatment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenCategory {
    /// Whitespace: spaces, tabs, newlines
    Whitespace,
    /// Punctuation and symbols
    Punctuation,
    /// Common English words (the, and, is, etc.)
    CommonWord,
    /// Less common words
    Word,
    /// Numbers and numeric tokens
    Numeric,
    /// Code-like tokens (braces, operators, keywords)
    Code,
    /// Special tokens (<|endoftext|>, etc.)
    Special,
    /// Partial / sub-word fragments
    Fragment,
}

/// Maps tokens to colors and categories.
pub struct TokenColorMap {
    /// Palette: category → [r, g, b]
    palette: [(TokenCategory, [u8; 3]); 8],
}

impl Default for TokenColorMap {
    fn default() -> Self {
        Self {
            palette: [
                // Frost glass inspired palette
                (TokenCategory::Whitespace,  [60, 70, 90]),       // dark slate
                (TokenCategory::Punctuation, [120, 140, 170]),    // steel blue
                (TokenCategory::CommonWord,  [0, 255, 204]),      // cyan-green (primary glow)
                (TokenCategory::Word,        [125, 244, 255]),    // bright cyan
                (TokenCategory::Numeric,     [255, 170, 50]),     // amber
                (TokenCategory::Code,        [16, 185, 129]),     // emerald
                (TokenCategory::Special,     [255, 80, 120]),     // hot pink
                (TokenCategory::Fragment,    [160, 120, 255]),    // purple
            ],
        }
    }
}

impl TokenColorMap {
    /// Determine the category of a token.
    pub fn categorize(&self, id: u32, text: &str) -> TokenCategory {
        // Special tokens (high IDs in most vocabs, or special text)
        if text.starts_with("<|") && text.ends_with("|>") {
            return TokenCategory::Special;
        }

        let trimmed = text.trim();

        // Whitespace
        if trimmed.is_empty() {
            return TokenCategory::Whitespace;
        }

        // Numeric
        if trimmed.chars().all(|c| c.is_ascii_digit() || c == '.' || c == ',') {
            return TokenCategory::Numeric;
        }

        // Code-like
        if is_code_token(trimmed) {
            return TokenCategory::Code;
        }

        // Punctuation
        if trimmed.chars().all(|c| c.is_ascii_punctuation()) {
            return TokenCategory::Punctuation;
        }

        // Common words (leading space is typical in BPE)
        let word = text.trim().to_lowercase();
        if is_common_word(&word) {
            return TokenCategory::CommonWord;
        }

        // Fragments (sub-word pieces, no leading space, short, not standalone)
        if !text.starts_with(' ') && text.len() <= 3 && id > 256 {
            return TokenCategory::Fragment;
        }

        TokenCategory::Word
    }

    /// Get the RGB color for a category.
    pub fn color_for(&self, category: &TokenCategory) -> [u8; 3] {
        self.palette
            .iter()
            .find(|(cat, _)| cat == category)
            .map(|(_, color)| *color)
            .unwrap_or([125, 244, 255]) // fallback: bright cyan
    }

    /// Compute a "rarity" weight 0.0-1.0 based on token ID.
    /// Lower IDs (single bytes) = common = low weight.
    /// Higher IDs (learned merges) = rarer = higher weight.
    pub fn weight_for(&self, id: u32, vocab_size: usize) -> f32 {
        if vocab_size == 0 {
            return 0.5;
        }
        (id as f32 / vocab_size as f32).min(1.0)
    }
}

fn is_common_word(word: &str) -> bool {
    matches!(
        word,
        "the" | "a" | "an" | "and" | "or" | "but" | "in" | "on" | "at" | "to"
        | "for" | "of" | "with" | "by" | "from" | "is" | "are" | "was" | "were"
        | "be" | "been" | "being" | "have" | "has" | "had" | "do" | "does" | "did"
        | "will" | "would" | "could" | "should" | "may" | "might" | "can"
        | "this" | "that" | "these" | "those" | "it" | "its"
        | "i" | "you" | "he" | "she" | "we" | "they" | "me" | "him" | "her" | "us" | "them"
        | "my" | "your" | "his" | "our" | "their"
        | "not" | "no" | "if" | "then" | "else" | "so" | "as" | "up"
    )
}

fn is_code_token(text: &str) -> bool {
    matches!(
        text,
        "{" | "}" | "[" | "]" | "(" | ")" | ";" | "::" | "->" | "=>" | "=="
        | "!=" | "<=" | ">=" | "&&" | "||" | "+=" | "-=" | "*=" | "/="
        | "fn" | "let" | "mut" | "const" | "pub" | "struct" | "enum" | "impl"
        | "trait" | "use" | "mod" | "async" | "await" | "return"
        | "function" | "var" | "class" | "import" | "export" | "def" | "self"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize_whitespace() {
        let cm = TokenColorMap::default();
        assert_eq!(cm.categorize(32, " "), TokenCategory::Whitespace);
        assert_eq!(cm.categorize(10, "\n"), TokenCategory::Whitespace);
    }

    #[test]
    fn test_categorize_common_word() {
        let cm = TokenColorMap::default();
        assert_eq!(cm.categorize(259, "the"), TokenCategory::CommonWord);
        assert_eq!(cm.categorize(300, " and"), TokenCategory::CommonWord);
    }

    #[test]
    fn test_categorize_numeric() {
        let cm = TokenColorMap::default();
        assert_eq!(cm.categorize(400, "42"), TokenCategory::Numeric);
        assert_eq!(cm.categorize(401, "3.14"), TokenCategory::Numeric);
    }

    #[test]
    fn test_categorize_code() {
        let cm = TokenColorMap::default();
        assert_eq!(cm.categorize(500, "fn"), TokenCategory::Code);
        assert_eq!(cm.categorize(501, "=>"), TokenCategory::Code);
    }

    #[test]
    fn test_categorize_special() {
        let cm = TokenColorMap::default();
        assert_eq!(
            cm.categorize(100000, "<|endoftext|>"),
            TokenCategory::Special
        );
    }

    #[test]
    fn test_color_roundtrip() {
        let cm = TokenColorMap::default();
        let color = cm.color_for(&TokenCategory::CommonWord);
        assert_eq!(color, [0, 255, 204]); // cyan-green
    }

    #[test]
    fn test_weight() {
        let cm = TokenColorMap::default();
        let w_low = cm.weight_for(10, 100000);
        let w_high = cm.weight_for(90000, 100000);
        assert!(w_low < w_high);
    }
}
