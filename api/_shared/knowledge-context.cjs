const MAX_CONTEXT_CHARS = 16000;

function formatContextEntry(result) {
  return `[fragmentId=${result.fragmentId}] [document=${result.document}] [page=${result.page ?? 'unknown'}]\n${String(result.text ?? '')}`;
}

function selectContextResults(results, maxChars = 12000) {
  const limit = Math.min(Math.max(Number(maxChars) || 12000, 1000), MAX_CONTEXT_CHARS);
  const selected = [];
  let characters = 0;
  for (const result of Array.isArray(results) ? results : []) {
    const entryLength = formatContextEntry(result).length;
    if (characters + entryLength > limit) continue;
    selected.push(result);
    characters += entryLength;
  }
  return { selected, characters, truncated: selected.length < (Array.isArray(results) ? results.length : 0) };
}

function makeDocumentContext(results, maxChars = 12000) {
  const { selected, characters, truncated } = selectContextResults(results, maxChars);
  return { text: selected.map(formatContextEntry).join('\n\n'), selected, characters, truncated };
}

module.exports = { MAX_CONTEXT_CHARS, formatContextEntry, selectContextResults, makeDocumentContext };
