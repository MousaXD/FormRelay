export function sanitizePreview(response) {
  if (response?.type !== 'preview' || !Array.isArray(response.changes)) {
    throw new Error('Unexpected preview response from FormRelay.');
  }
  return {
    page_match: response.pageMatch ?? null,
    changes: response.changes.map((change) => ({
      field_id: change?.imported?.field_id ?? null,
      label: change?.imported?.label ?? '',
      type: change?.imported?.type ?? '',
      proposed_value: change?.imported?.value,
      status: change?.status ?? 'invalid',
      confidence: change?.confidence ?? 0,
      message: change?.message ?? null,
    })),
  };
}
