# Changelog

## 0.1.1 - 2026-08-25

- Add the permanent Firefox extension ID `formrelay@mousaxd.dev` required for Manifest V3 signing through Mozilla Add-ons.
- Keep the existing privacy boundary and permissions unchanged (`activeTab` and `scripting` only).

## 0.1.0 - 2026-08-25

- Initial local-only FormRelay release.
- Firefox-first WXT/React popup with Chromium-compatible build target.
- Active-tab-only extraction through an unlisted injected script; no blanket host permission.
- Versioned strict JSON schema with Zod validation.
- Sensitive-field exclusion and no existing-value export.
- Stable field fingerprints, confidence matching, wrong-page warnings, and structural mutation checks.
- Preview and explicit approval before native-setter filling, including live HTML constraint probing.
- Support for text-like inputs, textarea, select, radio groups, standalone checkboxes, and checkbox groups.
- Deterministic external-AI prompt generation.
- Unit tests, CI/build workflows, security architecture, and source-available licensing documentation.
