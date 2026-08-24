# FormRelay

FormRelay is a local-first browser extension that turns a webpage form into structured, versioned JSON and safely applies completed JSON back to that form after explicit review.

**Source-available for personal and noncommercial use.** FormRelay is licensed under PolyForm Noncommercial 1.0.0. It is not presented as OSI Open Source. Commercial use requires separate written authorization; see `COMMERCIAL-LICENSE.md`.

## What v0.1.0 does

1. Open a page containing a normal HTML form.
2. Click FormRelay. The extension inspects only the active tab after that explicit interaction.
3. Export the selected form as JSON or copy an AI-ready prompt.
4. Give the prompt to any external assistant manually.
5. Paste or import the returned JSON.
6. FormRelay applies strict size, JSON, Zod, version, structure, page, matching, and constraint checks.
7. Review every proposed change and explicitly choose **Fill Safe Fields**.
8. Submit the page yourself. FormRelay never submits, continues, purchases, pays, signs, confirms, or agrees on your behalf.

## Privacy and permissions

v0.1.0 has **zero telemetry, analytics, tracking, remote API calls, accounts, backend servers, databases, or cloud storage**.

Production permissions are only `activeTab` and `scripting`. FormRelay does not request `<all_urls>`. The page bridge is a WXT unlisted script injected only into the active tab following extension interaction.

Existing page values are not included in exported JSON. Passwords, file inputs, hidden inputs, payment-card fields, CVC/CVV, one-time codes, API keys/tokens, private keys, and similar sensitive fields are excluded conservatively.

## Supported controls

Text, email, URL, telephone, number, date, time, search, textarea, select, standalone checkbox, checkbox groups, and radio groups.

## Deliberately unsupported in v0.1.0

Passwords, payments, files, CAPTCHA, hidden fields, autonomous browsing, automatic submission, direct LLM APIs, Shadow DOM traversal, and iframe traversal. On pages with multiple forms, v0.1.0 deterministically selects the form with the most supported controls; orphan controls are supported when no `<form>` exists.

## Development

Requires Node.js 22.12+ and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Firefox is the primary target. `pnpm build:firefox` and `pnpm build:chromium` build targets separately.

## Install an unpacked development build

After building, Firefox MV3 output is written under `.output/firefox-mv3/` and Chromium output under `.output/chrome-mv3/`.

- Firefox: open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`.
- Chrome/Chromium/Edge: open the browser's extensions page, enable developer mode, choose **Load unpacked**, and select `.output/chrome-mv3/`.

Store signing/publishing is separate from the local build. Firefox AMO signing requires the repository owner to choose a stable Gecko extension ID before publication; FormRelay does not invent one.

## Architecture

Core code is split by trust boundary: extraction, schema, import validation, matching, filling, prompt generation, and extension UI. Page text is always untrusted data. Imported JSON is never evaluated or interpreted as code. See `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/JSON_SCHEMA.md`.

## Contributing

See `docs/CONTRIBUTING.md`. Security issues should follow the private-reporting guidance in `SECURITY.md`.
