use std::net::SocketAddr;
use std::sync::Arc;

use prometheus::{
    Encoder, HistogramOpts, HistogramVec, IntCounterVec, IntGauge, Opts, Registry, TextEncoder,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::logging;

pub struct OperatorMetrics {
    registry: Registry,
    reconcile_total: IntCounterVec,
    reconcile_duration: HistogramVec,
    viewers_managed: IntGauge,
}

impl OperatorMetrics {
    pub fn new() -> Result<Arc<Self>, prometheus::Error> {
        let registry = Registry::new();

        let reconcile_total = IntCounterVec::new(
            Opts::new(
                "s3_viewer_operator_reconcile_total",
                "Total S3Viewer reconcile attempts",
            ),
            &["result"],
        )?;

        let reconcile_duration = HistogramVec::new(
            HistogramOpts::new(
                "s3_viewer_operator_reconcile_duration_seconds",
                "S3Viewer reconcile duration in seconds",
            ),
            &["result"],
        )?;

        let viewers_managed = IntGauge::new(
            "s3_viewer_operator_viewers_managed",
            "Number of S3Viewer resources tracked by the operator",
        )?;

        registry.register(Box::new(reconcile_total.clone()))?;
        registry.register(Box::new(reconcile_duration.clone()))?;
        registry.register(Box::new(viewers_managed.clone()))?;

        Ok(Arc::new(Self {
            registry,
            reconcile_total,
            reconcile_duration,
            viewers_managed,
        }))
    }

    pub fn record_reconcile(&self, result: &str, duration_secs: f64) {
        self.reconcile_total.with_label_values(&[result]).inc();
        self.reconcile_duration
            .with_label_values(&[result])
            .observe(duration_secs);
    }

    pub fn set_viewers_managed(&self, count: i64) {
        self.viewers_managed.set(count);
    }

    fn encode(&self) -> Vec<u8> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer).unwrap();
        buffer
    }
}

pub fn metrics_enabled() -> bool {
    match std::env::var("METRICS_ENABLED") {
        Ok(value) => value != "0" && !value.eq_ignore_ascii_case("false"),
        Err(_) => true,
    }
}

pub fn metrics_bind_addr() -> SocketAddr {
    std::env::var("METRICS_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_owned())
        .parse()
        .expect("METRICS_BIND must be a valid socket address")
}

pub async fn serve(metrics: Arc<OperatorMetrics>, addr: SocketAddr) {
    let listener = match TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(err) => {
            logging::error(&format!("failed to bind metrics server on {addr}: {err}"));
            return;
        }
    };

    logging::info(&format!(
        "metrics server listening on {addr} (Prometheus format at /metrics)"
    ));

    loop {
        let Ok((mut socket, _)) = listener.accept().await else {
            continue;
        };

        let metrics = metrics.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 512];
            let Ok(n) = socket.read(&mut buf).await else {
                return;
            };

            let request = String::from_utf8_lossy(&buf[..n]);
            let (status, content_type, body): (&str, &str, Vec<u8>) =
                if request.contains("GET /metrics") {
                    (
                        "200 OK",
                        "text/plain; version=0.0.4; charset=utf-8",
                        metrics.encode(),
                    )
                } else if request.contains("GET /health") || request.contains("GET /healthz") {
                    ("200 OK", "text/plain; charset=utf-8", b"ok\n".to_vec())
                } else {
                    (
                        "404 Not Found",
                        "text/plain; charset=utf-8",
                        b"not found\n".to_vec(),
                    )
                };

            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );

            let _ = socket.write_all(response.as_bytes()).await;
            let _ = socket.write_all(&body).await;
        });
    }
}
