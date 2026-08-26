const api = globalThis.browser ?? globalThis.chrome;
const resultElement = document.querySelector('#result');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function send(tabId, request) {
  try {
    return await api.tabs.sendMessage(tabId, request);
  } catch {
    await api.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/form.js'],
    });
    return api.tabs.sendMessage(tabId, request);
  }
}

async function run() {
  assert(api, 'WebExtension API is unavailable.');
  const targetUrl = new URL(location.href).searchParams.get('target');
  assert(targetUrl, 'Missing target fixture URL.');

  const tabs = await api.tabs.query({});
  const target = tabs.find((tab) => tab.url === targetUrl);
  assert(target?.id != null, `Could not find fixture tab: ${targetUrl}`);

  // Match the production path: FormRelay injects only into the active tab after
  // user interaction. Keeping the target active also preserves activeTab semantics
  // in Firefox instead of relying on test-only host permissions.
  await api.tabs.update(target.id, { active: true });

  const extracted = await send(target.id, { type: 'FORMRELAY_EXTRACT' });
  assert(extracted?.type === 'extract', 'Extraction bridge response was invalid.');
  assert(extracted.document.fields.length === 2, 'Expected exactly two supported fields.');
  assert(extracted.excludedSensitiveCount >= 1, 'Sensitive password field was not excluded.');
  assert(
    !extracted.document.fields.some((field) => field.name === 'password'),
    'Password field leaked into exported JSON.',
  );

  const imported = structuredClone(extracted.document);
  const name = imported.fields.find((field) => field.dom_id === 'full-name');
  assert(name?.type === 'text', 'Expected text field was not extracted.');
  assert(name.value === '', 'Existing text field value leaked into export.');
  name.value = 'Browser smoke';

  const preview = await send(target.id, { type: 'FORMRELAY_PREVIEW', document: imported });
  assert(preview?.type === 'preview', 'Preview bridge response was invalid.');
  const ready = preview.changes.filter((change) => change.status === 'ready');
  assert(ready.length === 1, 'Expected exactly one safe ready change.');
  assert(ready[0]?.liveValue === 'Existing private value', 'Local before-value preview was not captured.');
  assert(extracted.document.fields.find((field) => field.dom_id === 'full-name')?.value === '', 'Live value leaked back into exported JSON.');

  const fill = await send(target.id, {
    type: 'FORMRELAY_FILL',
    document: imported,
    allowPageMismatch: false,
  });
  assert(fill?.type === 'fill', 'Fill bridge response was invalid.');
  assert(fill.result.filled === 1, 'Expected exactly one field to be filled.');

  const [probe] = await api.scripting.executeScript({
    target: { tabId: target.id },
    func: () => ({
      name: document.querySelector('#full-name')?.value ?? null,
      password: document.querySelector('#password')?.value ?? null,
      submitCount: globalThis.__formRelaySubmitCount ?? -1,
    }),
  });
  const state = probe?.result;
  assert(state?.name === 'Browser smoke', 'Intended live control was not filled.');
  assert(state?.password === 'secret-password', 'Sensitive control was modified.');
  assert(state?.submitCount === 0, 'Form submission occurred during fill.');

  return {
    extractedFields: extracted.document.fields.length,
    excludedSensitiveCount: extracted.excludedSensitiveCount,
    filled: fill.result.filled,
    submitCount: state.submitCount,
  };
}

run()
  .then((result) => {
    resultElement.textContent = JSON.stringify({ ok: true, ...result });
    document.body.dataset.done = 'true';
  })
  .catch((error) => {
    resultElement.textContent = JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    document.body.dataset.done = 'true';
    document.body.dataset.failed = 'true';
  });
