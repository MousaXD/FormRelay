# Architecture

## Trust boundaries

FormRelay has three relevant zones: the popup UI, the extension isolated world injected into the active page, and untrusted webpage/imported data. There is no backend.

The popup obtains the active tab after a user gesture and injects WXT's unlisted `form.js` with `browser.scripting.executeScript`. No persistent host permission is needed. The bridge registers an idempotent message listener in the extension isolated world and performs extraction, preview matching, and final filling.

## Data path

Export: DOM → supported-control selection → sensitive-field exclusion → label/context extraction → fingerprinting → FormRelay v1 document → JSON/prompt.

Import: text/file → 512 KiB byte limit → `JSON.parse` → strict Zod schema → schema version → fresh DOM extraction → wrong-page comparison → field matching → structural/constraint validation → preview → explicit user approval → fresh revalidation → native DOM setter/event dispatch.

## Stable identifiers

`field_id` is an FNV-1a fingerprint over normalized form identity, type, name, DOM id, label, autocomplete, placeholder, and fieldset legend. Relative position is used only when semantic identity signals are absent. Matching falls back from exact fingerprint to DOM id+name, name+type, label+type, then a contextual match. Low-confidence and ambiguous matches are unresolved.

## Multiple forms

v0.1 selects the form containing the largest number of supported controls, with DOM order as the deterministic tie-breaker. A page with no `<form>` uses supported orphan controls in the document.

## Framework-controlled inputs

Filling invokes the native prototype setter for `value`/`checked`, then emits bubbling, composed `input` and `change` events. This is compatible with common controlled-input patterns without executing page-provided code.
