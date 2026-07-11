use rusqlite::Connection;

fn main() {
    let db_path = std::env::args().nth(1).expect("database path is required");
    let key = std::env::args().nth(2).expect("app_state key is required");
    let conn = Connection::open(db_path).expect("database should open");
    let value: Option<String> = conn
        .query_row("SELECT value FROM app_state WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .ok();
    if let Some(value) = value {
        println!("{value}");
    }
}
