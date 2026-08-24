# Mozilla reviewer build instructions

FormRelay is built with WXT, Vite, TypeScript, React, and Zod.

## Requirements

- Node.js 22.13.0 or newer in the Node 22 line
- pnpm 11.23.0

## Reproduce the submitted Firefox extension

```bash
corepack enable
corepack prepare pnpm@11.23.0 --activate
pnpm install --frozen-lockfile
pnpm build:firefox
```

The Firefox extension is generated at:

```text
.output/firefox-mv3/
```

The release workflow submits that directory to Mozilla using `web-ext` and uploads this repository source archive with the submission.

## AMO validator warnings

FormRelay application code does not use `eval`, the `Function` constructor, `dangerouslySetInnerHTML`, or dynamic `innerHTML` assignment. The generated bundle may contain generic dependency code that triggers AMO warnings, including Zod capability/JIT detection and React DOM renderer internals. Imported JSON is treated as untrusted data and must pass the strict FormRelay Zod schema before it can be previewed or applied.

FormRelay never auto-submits forms.
