# syntax=docker/dockerfile:1

FROM rust:1.95-bookworm AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/s3-viewer-operator/Cargo.toml .
COPY apps/s3-viewer-operator/Cargo.lock .
COPY apps/s3-viewer-operator/src ./src

RUN cargo build --release

###

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 s3-viewer-operator \
    && useradd --uid 1001 --gid 1001 --system --no-create-home s3-viewer-operator

COPY --from=builder /app/target/release/s3-viewer-operator /usr/local/bin/s3-viewer-operator

USER s3-viewer-operator

ENV S3_VIEWER_DEFAULT_IMAGE=ghcr.io/tchoupinax/s3-viewer:latest

ENTRYPOINT ["s3-viewer-operator"]
