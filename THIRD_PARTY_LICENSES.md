# Third-Party Licenses

WorkspaceTabs is licensed under the MIT License. Its direct dependencies use permissive open-source licenses, including:

- Tauri and Tauri plugins: MIT or Apache-2.0
- Lucide icons: ISC
- Tokio, Axum, Serde, rusqlite, notify, rfd, and other Rust dependencies: primarily MIT or Apache-2.0
- Vite and Vitest development tools: MIT
- TypeScript: Apache-2.0

The complete resolved dependency versions are recorded in `package-lock.json` and the Cargo lockfiles. Some transitive Rust dependencies use MPL-2.0, BSD, ISC, Unicode-3.0, Zlib, CC0, or compatible dual-license terms. Their source distributions and license texts are available from the package metadata referenced by those lockfiles.

When publishing binary releases, regenerate and review a complete machine-generated license report for the exact release dependency graph.
