FROM gcr.io/distroless/nodejs26-debian13:nonroot

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY apps/s3-viewer/.output /app/output

CMD ["output/server/index.mjs"]
