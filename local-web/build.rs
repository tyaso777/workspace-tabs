use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let dist_dir = manifest_dir.join("../explorer-shell/dist");
    let icon_path = manifest_dir.join("../explorer-shell/src-tauri/icons/icon.ico");
    println!("cargo:rerun-if-changed={}", dist_dir.display());
    println!("cargo:rerun-if-changed={}", icon_path.display());

    let mut files = Vec::new();
    collect_files(&dist_dir, &dist_dir, &mut files);
    files.sort_by(|left, right| left.0.cmp(&right.0));

    let mut generated = String::from(
        "pub fn embedded_asset(path: &str) -> Option<(&'static str, &'static [u8])> {\n    match path {\n",
    );
    for (route, file) in files {
        let mime = mime_for(&route);
        generated.push_str(&format!(
            "        {:?} => Some(({:?}, include_bytes!(r#\"{}\"#))),\n",
            route,
            mime,
            file.display()
        ));
    }
    generated.push_str("        _ => None,\n    }\n}\n");

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    fs::write(out_dir.join("embedded_assets.rs"), generated).unwrap();

    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let resource_file = out_dir.join("workspace-tabs-local-web.rc");
        fs::write(
            &resource_file,
            format!("1 ICON {:?}\n", icon_path.to_string_lossy()),
        )
        .unwrap();
        embed_resource::compile(resource_file, embed_resource::NONE)
            .manifest_optional()
            .unwrap();
    }
}

fn collect_files(root: &Path, current: &Path, files: &mut Vec<(String, PathBuf)>) {
    let entries = fs::read_dir(current).unwrap_or_else(|error| {
        panic!(
            "Local Web requires explorer-shell/dist. Run the frontend build first: {}",
            error
        )
    });
    for entry in entries {
        let path = entry.unwrap().path();
        if path.is_dir() {
            collect_files(root, &path, files);
        } else {
            let relative = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            files.push((format!("/{relative}"), path));
        }
    }
}

fn mime_for(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".js") {
        "text/javascript; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else {
        "application/octet-stream"
    }
}
