use chrono::Utc;

pub fn info(message: &str) {
    println!("[{}] {}", Utc::now().to_rfc3339(), message);
}

pub fn error(message: &str) {
    eprintln!("[{}] ERROR {}", Utc::now().to_rfc3339(), message);
}
