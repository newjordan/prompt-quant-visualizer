use criterion::{black_box, criterion_group, criterion_main, Criterion};
use prompt_quant_core::{tokenize, VocabId};

fn bench_tokenize_short(c: &mut Criterion) {
    c.bench_function("tokenize_short", |b| {
        b.iter(|| tokenize(black_box("hello world"), &VocabId::cl100k()));
    });
}

fn bench_tokenize_medium(c: &mut Criterion) {
    let input = "The quick brown fox jumps over the lazy dog. ".repeat(10);
    c.bench_function("tokenize_medium", |b| {
        b.iter(|| tokenize(black_box(&input), &VocabId::cl100k()));
    });
}

fn bench_tokenize_long(c: &mut Criterion) {
    let input = "The quick brown fox jumps over the lazy dog. ".repeat(100);
    c.bench_function("tokenize_long", |b| {
        b.iter(|| tokenize(black_box(&input), &VocabId::cl100k()));
    });
}

criterion_group!(
    benches,
    bench_tokenize_short,
    bench_tokenize_medium,
    bench_tokenize_long,
);
criterion_main!(benches);
