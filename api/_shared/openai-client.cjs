const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1500;
const RESPONSES_URL = 'https://api.openai.com/v1/responses';

function getOpenAIConfig(env = process.env) {
  const apiKey = String(env.OPENAI_API_KEY ?? '').trim();
  const model = String(env.OPENAI_MODEL ?? '').trim();
  const timeoutMs = Number(env.OPENAI_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxOutputTokens = Number(env.OPENAI_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_OUTPUT_TOKENS);
  const maxContextChars = Number(env.OPENAI_MAX_CONTEXT_CHARS ?? 12000);
  return { configured: Boolean(apiKey && model), apiKey, model, timeoutMs: Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 1000), 30000) : DEFAULT_TIMEOUT_MS, maxOutputTokens: Number.isFinite(maxOutputTokens) ? Math.min(Math.max(maxOutputTokens, 100), 1600) : DEFAULT_MAX_OUTPUT_TOKENS, maxContextChars: Number.isFinite(maxContextChars) ? Math.min(Math.max(maxContextChars, 2000), 16000) : 12000 };
}

function diagnosticsEnabled(env = process.env) { return String(env.NODE_ENV ?? '').toLowerCase() === 'development' && String(env.OPENAI_DIAGNOSTICS ?? '').toLowerCase() === 'true'; }
function logDiagnostics(log, payload) { if (diagnosticsEnabled()) log?.(`[knowledge-ask][diagnostic] ${JSON.stringify(payload)}`); }
function safeOpenAIError(error, operation = 'request') { return { operation, statusCode: Number(error?.status ?? error?.statusCode ?? 0) || undefined, code: typeof error?.code === 'string' ? error.code : undefined, requestId: typeof error?.request_id === 'string' ? error.request_id : undefined }; }
function classifyIncompleteReason(reason) { return reason === 'max_output_tokens' ? 'max_output_tokens' : reason === 'content_filter' ? 'content_filter' : 'unknown'; }
function extractOutputText(payload) { if (typeof payload?.output_text === 'string') return payload.output_text; return (payload?.output ?? []).flatMap((item) => item?.content ?? []).filter((item) => item?.type === 'output_text' && typeof item.text === 'string').map((item) => item.text).join(''); }

async function askOpenAI({ question, context, instructions, history = '', config = getOpenAIConfig(), fetchImpl = globalThis.fetch, log }) {
  if (!config.configured) { const error = new Error('OPENAI_NOT_CONFIGURED'); error.code = 'OPENAI_NOT_CONFIGURED'; throw error; }
  if (typeof fetchImpl !== 'function') { const error = new Error('FETCH_UNAVAILABLE'); error.code = 'FETCH_UNAVAILABLE'; throw error; }
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const body = {
    model: config.model,
    instructions: instructions || 'Responde en español utilizando el contexto disponible y distingue hechos de recomendaciones.',
    store: false,
    max_output_tokens: config.maxOutputTokens,
    input: [{ role: 'user', content: [{ type: 'input_text', text: `${history}\nPREGUNTA:\n${question}\n\nCONTEXTO DISPONIBLE:\n<context-data>\n${context}\n</context-data>` }] }],
    text: { format: { type: 'json_schema', name: 'knowledge_answer', strict: true, schema: { type: 'object', additionalProperties: false, properties: {
      answer: { type: 'string' },
      references: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { fragmentId: { type: 'string' }, document: { type: 'string' }, page: { anyOf: [{ type: 'integer' }, { type: 'null' }] } }, required: ['fragmentId', 'document', 'page'] } },
      answerStatus: { type: 'string', enum: ['answered', 'insufficient-evidence', 'out-of-scope'] },
      answerType: { type: 'string', enum: ['internal-document', 'corporate-identity', 'corporate-web', 'general-knowledge', 'reasoned-advice', 'mixed'] },
    }, required: ['answer', 'references', 'answerStatus', 'answerType'] } } },
  };
  try {
    const response = await fetchImpl(RESPONSES_URL, { method: 'POST', headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) { const error = new Error('OPENAI_REQUEST_FAILED'); error.status = response.status; error.code = response.status === 401 || response.status === 403 ? 'AUTHENTICATION' : response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'UPSTREAM' : 'BAD_REQUEST'; logDiagnostics(log, { phase: 'http-error', model: config.model, statusCode: response.status, code: error.code }); throw error; }
    const payload = await response.json(); const outputItems = Array.isArray(payload?.output) ? payload.output : []; const usage = payload?.usage ?? null;
    logDiagnostics(log, { phase: 'response', model: config.model, status: payload?.status ?? null, incompleteReason: payload?.incomplete_details?.reason ? classifyIncompleteReason(payload.incomplete_details.reason) : null, inputTokens: Number(usage?.input_tokens ?? 0), outputTokens: Number(usage?.output_tokens ?? 0), reasoningTokens: Number(usage?.output_tokens_details?.reasoning_tokens ?? 0), outputItemCount: outputItems.length, outputItemTypes: outputItems.map((item) => item?.type ?? 'unknown'), hasOutputText: typeof payload?.output_text === 'string' });
    if (payload?.status === 'incomplete' || payload?.incomplete_details) { const error = new Error('OPENAI_INCOMPLETE_RESPONSE'); error.code = 'OPENAI_INCOMPLETE_RESPONSE'; error.reason = classifyIncompleteReason(payload?.incomplete_details?.reason); error.incompleteReason = error.reason; throw error; }
    const text = extractOutputText(payload);
    if (!text) { const error = new Error('OPENAI_INVALID_RESPONSE'); error.code = 'OPENAI_INVALID_RESPONSE'; throw error; }
    try { return { data: JSON.parse(text), usage }; } catch { const error = new Error('OPENAI_INVALID_RESPONSE'); error.code = 'OPENAI_INVALID_RESPONSE'; throw error; }
  } catch (error) { if (error?.name === 'AbortError') error.code = 'TIMEOUT'; log?.(`[knowledge-ask] ${JSON.stringify(safeOpenAIError(error))}`); throw error; } finally { clearTimeout(timeout); }
}

module.exports = { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_OUTPUT_TOKENS, getOpenAIConfig, safeOpenAIError, classifyIncompleteReason, diagnosticsEnabled, extractOutputText, askOpenAI };
