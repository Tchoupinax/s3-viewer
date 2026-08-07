use chrono::Utc;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Level {
    Error = 1,
    Warn = 2,
    Info = 3,
    Debug = 4,
    Trace = 5,
}

static MAX_LEVEL: OnceLock<Level> = OnceLock::new();

fn max_level() -> Level {
    *MAX_LEVEL.get_or_init(|| {
        parse_level(
            &std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_owned()),
        )
    })
}

fn parse_level(raw: &str) -> Level {
    match raw.trim().to_ascii_lowercase().as_str() {
        "error" | "err" => Level::Error,
        "warn" | "warning" => Level::Warn,
        "info" => Level::Info,
        "debug" | "dbg" => Level::Debug,
        "trace" => Level::Trace,
        other => {
            eprintln!(
                "[{}] WARN unknown LOG_LEVEL={other:?}; defaulting to info",
                Utc::now().to_rfc3339()
            );
            Level::Info
        }
    }
}

fn enabled(level: Level) -> bool {
    level <= max_level()
}

fn emit(level: Level, label: &str, message: &str) {
    if !enabled(level) {
        return;
    }

    let line = format!("[{}] {label} {message}", Utc::now().to_rfc3339());
    match level {
        Level::Error | Level::Warn => eprintln!("{line}"),
        Level::Info | Level::Debug | Level::Trace => println!("{line}"),
    }
}

pub fn error(message: &str) {
    emit(Level::Error, "ERROR", message);
}

pub fn warn(message: &str) {
    emit(Level::Warn, "WARN", message);
}

pub fn info(message: &str) {
    emit(Level::Info, "INFO", message);
}

pub fn debug(message: &str) {
    emit(Level::Debug, "DEBUG", message);
}

pub fn trace(message: &str) {
    emit(Level::Trace, "TRACE", message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_level_variants() {
        assert_eq!(parse_level("info"), Level::Info);
        assert_eq!(parse_level("DEBUG"), Level::Debug);
        assert_eq!(parse_level("warning"), Level::Warn);
    }
}
