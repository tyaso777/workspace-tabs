# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub Security Advisories instead of opening a public issue.

## Dependency audit notes

The Desktop dependency graph currently includes `quick-xml 0.39.4` through Tauri's `plist 1.9.0`. RustSec advisories `RUSTSEC-2026-0194` and `RUSTSEC-2026-0195` apply when parsing attacker-controlled XML. WorkspaceTabs does not expose an XML input or XML parsing feature; this dependency is used internally by Tauri. The project will update it when the upstream `plist` constraint permits `quick-xml >= 0.41.0`.

Do not treat this reachability assessment as a permanent exception. Dependabot and periodic `cargo audit` runs should be used to detect an upstream fix.
