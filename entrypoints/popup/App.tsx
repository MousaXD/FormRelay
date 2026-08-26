import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { generatePrompt } from '../../src/ai/generatePrompt';
import { downloadJson } from '../../src/export/downloadJson';
import { exportJson } from '../../src/export/exportJson';
import { parseImport } from '../../src/import/parseImport';
import { comparePage } from '../../src/import/validateImport';
import type { FormRelayDocument, FormRelayField } from '../../src/schema/formSchema';
import type { BridgeRequest, BridgeResponse } from '../../src/types/messages';

async function activeTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('No active tab is available.');
  return tab.id;
}

function hasProperty(value: object, key: string): value is Record<string, unknown> {
  return key in value;
}

function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (value === null || typeof value !== 'object' || !hasProperty(value, 'type')) return false;
  const type = value.type;
  return type === 'extract' || type === 'preview' || type === 'fill';
}

async function send(request: BridgeRequest): Promise<BridgeResponse> {
  const tabId = await activeTabId();
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['content-scripts/form.js'],
  });
  const response: unknown = await browser.tabs.sendMessage(tabId, request);
  if (!isBridgeResponse(response)) throw new Error('Unexpected FormRelay bridge response.');
  return response;
}

async function extractCurrent(): Promise<Extract<BridgeResponse, { type: 'extract' }>> {
  const response = await send({ type: 'FORMRELAY_EXTRACT' });
  if (response.type !== 'extract') throw new Error('Unexpected extract response.');
  return response;
}

async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function shown(value: FormRelayField['value']): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'checked' : 'unchecked';
  return value;
}

export default function App() {
  const [current, setCurrent] = useState<FormRelayDocument | null>(null);
  const [excluded, setExcluded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [imported, setImported] = useState<FormRelayDocument | null>(null);
  const [preview, setPreview] = useState<Extract<BridgeResponse, { type: 'preview' }> | null>(null);
  const [wrongPage, setWrongPage] = useState<string | null>(null);
  const [overridePage, setOverridePage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      setError(null);
      const response = await extractCurrent();
      setCurrent(response.document);
      setExcluded(response.excludedSensitiveCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not inspect this page.');
    }
  };

  useEffect(() => {
    let active = true;

    void extractCurrent()
      .then((response) => {
        if (!active) return;
        setCurrent(response.document);
        setExcluded(response.excludedSensitiveCount);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Could not inspect this page.');
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!preview) return null;
    return {
      ready: preview.changes.filter((change) => change.status === 'ready').length,
      empty: preview.changes.filter((change) => change.status === 'empty').length,
      unresolved: preview.changes.filter((change) => change.status === 'unresolved').length,
      invalid: preview.changes.filter((change) => change.status === 'invalid').length,
    };
  }, [preview]);

  const importText = async (text: string) => {
    setError(null);
    setNotice(null);
    const parsed = parseImport(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const response = await send({ type: 'FORMRELAY_PREVIEW', document: parsed.document });
    if (response.type !== 'preview') throw new Error('Unexpected preview response.');

    const page = comparePage(parsed.document, response.current);
    setImported(parsed.document);
    setPreview(response);
    setWrongPage(page.warning);
    setOverridePage(page.matches);
    setPasteOpen(false);
  };

  const doCopyJson = async () => {
    if (!current) return;
    try {
      setError(null);
      await copy(exportJson(current));
      setNotice('Form JSON copied.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Copy failed.');
    }
  };

  const doPrompt = async () => {
    if (!current) return;
    try {
      setError(null);
      await copy(generatePrompt(current));
      setNotice('AI-ready prompt copied.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Copy failed.');
    }
  };

  const doFill = async () => {
    if (!imported || !stats || stats.ready === 0 || (wrongPage && !overridePage)) return;
    try {
      setError(null);
      const response = await send({
        type: 'FORMRELAY_FILL',
        document: imported,
        allowPageMismatch: Boolean(wrongPage && overridePage),
      });
      if (response.type !== 'fill') throw new Error('Unexpected fill response.');
      setNotice(
        `Filled ${response.result.filled} field${response.result.filled === 1 ? '' : 's'}. ${response.result.skipped} skipped.`,
      );
      if (response.result.errors.length > 0) setError(response.result.errors.join(' '));
      setPreview(null);
      setImported(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Fill failed.');
    }
  };

  return (
    <main className="popup">
      <header>
        <div>
          <h1>FormRelay</h1>
          <p>{current ? `${current.fields.length} fields detected` : 'Inspecting form…'}</p>
        </div>
        <span className="local">Local only</span>
      </header>

      {excluded > 0 && (
        <div className="warning" role="status">
          FormRelay excluded {excluded} potentially sensitive field{excluded === 1 ? '' : 's'}.
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      {!preview && (
        <>
          <section className="stack" aria-label="Export form">
            <button className="primary" onClick={() => void doCopyJson()} disabled={!current}>
              Export Form · Copy JSON
            </button>
            <button
              onClick={() => {
                if (current) downloadJson(exportJson(current));
              }}
              disabled={!current}
            >
              Download JSON
            </button>
            <button onClick={() => void doPrompt()} disabled={!current}>
              Copy AI Prompt
            </button>
          </section>

          <div className="divider" />

          <section aria-labelledby="completed-json-heading">
            <h2 id="completed-json-heading">Have completed JSON?</h2>
            <div className="row">
              <button onClick={() => setPasteOpen((value) => !value)}>Paste JSON</button>
              <button onClick={() => fileRef.current?.click()}>Import JSON File</button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 512 * 1024) {
                  setError('Imported JSON exceeds the 512 KiB safety limit.');
                  return;
                }
                void file.text().then(importText).catch(() => setError('Could not read JSON file.'));
              }}
            />
            {pasteOpen && (
              <div className="paste">
                <label htmlFor="json">Completed FormRelay JSON</label>
                <textarea
                  id="json"
                  rows={7}
                  value={paste}
                  onChange={(event) => setPaste(event.target.value)}
                  autoFocus
                />
                <button
                  className="primary"
                  onClick={() => void importText(paste)}
                  disabled={!paste.trim()}
                >
                  Validate & Review
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {preview && stats && (
        <section className="review" aria-labelledby="review-heading">
          <h2 id="review-heading">Review changes</h2>
          <p>
            {preview.changes.length} answers received · {stats.ready} ready · {stats.empty} empty ·{' '}
            {stats.unresolved} unresolved{stats.invalid ? ` · ${stats.invalid} invalid` : ''}
          </p>

          {wrongPage && (
            <div className="warning">
              <strong>{wrongPage}</strong>
              <label className="override">
                <input
                  type="checkbox"
                  checked={overridePage}
                  onChange={(event) => setOverridePage(event.target.checked)}
                />
                I understand and want to override this page warning.
              </label>
            </div>
          )}

          <ul>
            {preview.changes.map((change, index) => (
              <li
                key={`${change.imported.field_id}-${index}`}
                className={`status-${change.status}`}
              >
                <strong>
                  {change.imported.label ?? change.imported.name ?? change.imported.field_id}
                </strong>
                <span>
                  {change.status === 'ready'
                    ? `“${shown(change.liveValue ?? change.current.value)}” → “${shown(change.imported.value)}”`
                    : (change.message ?? change.status)}
                </span>
              </li>
            ))}
          </ul>

          <div className="row">
            <button
              onClick={() => {
                setPreview(null);
                setImported(null);
              }}
            >
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => void doFill()}
              disabled={stats.ready === 0 || Boolean(wrongPage && !overridePage)}
            >
              Fill {stats.ready} Safe Field{stats.ready === 1 ? '' : 's'}
            </button>
          </div>
        </section>
      )}

      <footer>No uploads · No accounts · FormRelay does not directly submit forms</footer>
    </main>
  );
}
