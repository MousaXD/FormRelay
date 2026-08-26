# FormRelay MCP companion

This is an opt-in local companion for exposing FormRelay through Model Context Protocol (MCP).

It deliberately keeps browser power narrow:

- `formrelay_status` checks whether the browser bridge is connected.
- `inspect_form` exports FormRelay's redacted form document. Existing user-entered values and sensitive controls are not sent to MCP.
- `preview_fill` validates proposed data without changing the page and strips local live "before" values from the MCP result.
- `fill_form` requires a fresh one-time approval ID from `preview_fill`, `confirmed: true`, and a page identity match. It never enables FormRelay's page-mismatch override and never submits the form.

The companion has two MCP transports from the same server factory:

- **stdio** for Gemini CLI and other local MCP hosts.
- **Streamable HTTP** at `/mcp` for HTTP-capable MCP clients.

The browser-to-companion hop is separate from MCP. It uses an optional WebExtension native-messaging permission and a localhost-only authenticated broker. The broker writes a short-lived 0600 state file under `~/.formrelay/mcp-bridge.json`; the native host reads it and authenticates with a random 256-bit token.

## Install dependencies

```bash
cd mcp
npm install
```

Direct dependencies are intentionally pinned.

## Gemini CLI via stdio

From the repository root:

```bash
gemini mcp add --scope user formrelay node "$PWD/mcp/bin/formrelay-mcp.js" stdio
```

Do **not** use `--trust` for FormRelay. Keeping Gemini's confirmation UI enabled is part of the intended safety boundary, especially for `fill_form`.

Verify with:

```bash
gemini mcp list
```

## Streamable HTTP

Start the local endpoint:

```bash
node mcp/bin/formrelay-mcp.js http
```

Default endpoint:

```text
http://127.0.0.1:37821/mcp
```

Gemini CLI can use it directly:

```bash
gemini mcp add --scope user --transport http formrelay-http http://127.0.0.1:37821/mcp
```

To bind outside loopback, `FORMRELAY_MCP_HTTP_TOKEN` is mandatory:

```bash
FORMRELAY_MCP_HTTP_TOKEN='replace-with-a-long-random-secret' \
  node mcp/bin/formrelay-mcp.js http --host 0.0.0.0 --port 37821
```

Clients must then send:

```text
Authorization: Bearer replace-with-a-long-random-secret
```

For OpenAI/ChatGPT-style remote MCP clients, expose the local `/mcp` endpoint only through a TLS tunnel or reverse proxy that preserves the Authorization header. Do not expose the raw localhost broker or the native host.

## Linux native-host registration

The browser extension must explicitly grant the optional `nativeMessaging` permission before it can connect.

Firefox's FormRelay ID in this repository is:

```text
mousashriteh0@gmail.com
```

Register the host for Firefox:

```bash
node mcp/bin/install-native-host.js firefox mousashriteh0@gmail.com
```

For Chromium/Chrome, pass the actual extension ID shown by the browser:

```bash
node mcp/bin/install-native-host.js chromium YOUR_EXTENSION_ID
# or
node mcp/bin/install-native-host.js chrome YOUR_EXTENSION_ID
```

The helper prints the manifest path it installed.

## Data boundary

MCP is optional. Without enabling it, FormRelay keeps its normal local-only export/import workflow.

When MCP is enabled, form structure and AI-proposed data can leave the extension through the local companion and may then be transmitted by the MCP client to its configured AI provider. Current live field values are intentionally withheld from MCP previews. Sensitive controls remain excluded by FormRelay's normal extraction rules.
