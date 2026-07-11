use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::Path;

const MAX_PREVIEW_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PreviewDto {
    pub path: String,
    pub content: Option<String>,
    pub truncated: bool,
    pub message: Option<String>,
}

pub fn preview_file(path: &Path) -> PreviewDto {
    match read_text_preview(path, MAX_PREVIEW_BYTES) {
        Ok(content) => PreviewDto {
            path: path.display().to_string(),
            content: Some(content.text),
            truncated: content.truncated,
            message: None,
        },
        Err(message) => PreviewDto {
            path: path.display().to_string(),
            content: None,
            truncated: false,
            message: Some(message),
        },
    }
}

struct TextPreview {
    text: String,
    truncated: bool,
}

fn read_text_preview(path: &Path, max_bytes: u64) -> Result<TextPreview, String> {
    if path.is_dir() {
        return Err("Folders cannot be previewed.".to_string());
    }
    if !is_supported_text_path(path) {
        return Err("Preview supports text-like files only.".to_string());
    }

    let mut file = File::open(path)
        .map_err(|error| format!("Failed to open '{}': {}", path.display(), error))?;
    let mut bytes = Vec::new();
    file.by_ref()
        .take(max_bytes + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Failed to read '{}': {}", path.display(), error))?;
    let truncated = bytes.len() as u64 > max_bytes;
    if truncated {
        bytes.truncate(max_bytes as usize);
    }
    let text = String::from_utf8(bytes).map_err(|_| "File is not valid UTF-8 text.".to_string())?;
    Ok(TextPreview { text, truncated })
}

fn is_supported_text_path(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "txt"
            | "md"
            | "rs"
            | "toml"
            | "json"
            | "csv"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "html"
            | "css"
            | "log"
            | "yaml"
            | "yml"
            | "xml"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn previews_supported_text_file() {
        let path = write_temp_file("sample.md", "hello\nworld");

        let preview = preview_file(&path);

        assert_eq!(preview.content, Some("hello\nworld".to_string()));
        assert!(!preview.truncated);
        assert!(preview.message.is_none());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_unsupported_extension() {
        let path = write_temp_file("image.png", "not really an image");

        let preview = preview_file(&path);

        assert!(preview.content.is_none());
        assert_eq!(
            preview.message,
            Some("Preview supports text-like files only.".to_string())
        );
        let _ = fs::remove_file(path);
    }

    #[test]
    fn truncates_large_text_file() {
        let path = write_temp_file("large.txt", &"a".repeat((MAX_PREVIEW_BYTES as usize) + 10));

        let preview = preview_file(&path);

        assert_eq!(preview.content.unwrap().len(), MAX_PREVIEW_BYTES as usize);
        assert!(preview.truncated);
        let _ = fs::remove_file(path);
    }

    fn write_temp_file(name: &str, content: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("explorer-shell-{}-{}", unique, name));
        fs::write(&path, content).unwrap();
        path
    }
}
