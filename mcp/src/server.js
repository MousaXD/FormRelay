import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './constants.js';
import { sanitizePreview } from './sanitize.js';

const formDocumentSchema = z.object({
  schema_version: z.number().int(),
  page: z.record(z.string(), z.unknown()),
  form: z.record(z.string(), z.unknown()),
  fields: z.array(z.record(z.string(), z.unknown())).max(500),
});

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

export function buildServer({ bridge, approvals }) {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions:
        'FormRelay is a local-first form assistant. Inspect and preview before filling. Never call fill_form until the human explicitly approves the preview. FormRelay never submits a form, but page scripts may react to input/change events.',
    },
  );

  server.registerTool(
    'formrelay_status',
    {
      title: 'FormRelay status',
      description: 'Check whether the opt-in FormRelay browser bridge is connected.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => textResult({ connected: bridge.connected }),
  );

  server.registerTool(
    'inspect_form',
    {
      title: 'Inspect current form',
      description:
        'Inspect the active page with FormRelay. Sensitive controls and existing user-entered values are excluded from this MCP result.',
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const response = await bridge.request({ type: 'FORMRELAY_EXTRACT' });
        if (response?.type !== 'extract') throw new Error('Unexpected extract response from FormRelay.');
        return textResult({
          document: response.document,
          excluded_sensitive_count: response.excludedSensitiveCount ?? 0,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'preview_fill',
    {
      title: 'Preview form fill',
      description:
        'Validate a completed FormRelay document against the active page without changing the page. Existing live field values are intentionally omitted from the MCP response. Returns a short-lived approval_id for the exact document.',
      inputSchema: z.object({ document: formDocumentSchema }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ document }) => {
      try {
        const response = await bridge.request({ type: 'FORMRELAY_PREVIEW', document });
        const preview = sanitizePreview(response);
        return textResult({
          ...preview,
          approval_id: approvals.issue(document),
          approval_expires_in_seconds: 300,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'fill_form',
    {
      title: 'Fill form after approval',
      description:
        'Fill the active form with a document that was just previewed. Requires the one-time approval_id from preview_fill and confirmed=true after explicit human approval. Page-mismatch overrides are never allowed through MCP. This does not submit the form.',
      inputSchema: z.object({
        document: formDocumentSchema,
        approval_id: z.string().uuid(),
        confirmed: z.literal(true),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ document, approval_id: approvalId }) => {
      try {
        if (!approvals.consume(approvalId, document)) {
          throw new Error('Approval is missing, expired, already used, or belongs to different form data. Run preview_fill again and ask the human to approve it.');
        }
        const previewResponse = await bridge.request({ type: 'FORMRELAY_PREVIEW', document });
        if (previewResponse?.pageMatch?.matches === false) {
          throw new Error(previewResponse.pageMatch.warning || 'FormRelay page identity does not match this document.');
        }
        const response = await bridge.request({
          type: 'FORMRELAY_FILL',
          document,
          allowPageMismatch: false,
        });
        if (response?.type !== 'fill') throw new Error('Unexpected fill response from FormRelay.');
        return textResult({ result: response.result, submitted: false });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}
