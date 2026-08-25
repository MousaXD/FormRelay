# Changelog

## 0.1.3 - 2026-08-25

- Replace the default extension artwork with the new FormRelay app icon across Firefox and Chromium packages.
- Keep Mozilla signing, self-hosted Firefox updates, permissions, and privacy behavior unchanged.

## 0.1.2 - 2026-08-25

- Automate unlisted Mozilla signing for new Firefox releases using GitHub Actions.
- Upload a reproducible source archive to Mozilla with every automated Firefox submission.
- Attach the Mozilla-signed XPI to the matching GitHub Release.
- Add a self-hosted Firefox update manifest so signed installs can receive future updates automatically.
- Raise the Firefox minimum version to 142 so `data_collection_permissions` is supported on both desktop and Android validators.
- Keep the privacy boundary and permissions unchanged (`activeTab` and `scripting` only).

## 0.1.1 - 2026-08-25

- Add the permanent Firefox extension ID `mousashriteh0@gmail.com` required for Manifest V3 signing through Mozilla Add-ons.
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
