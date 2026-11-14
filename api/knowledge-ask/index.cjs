const { getPrincipalFromRequest, isAdminPrincipal } = require('../_shared/auth.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');
const { getStorageErrorDetails } = require('../_shared/knowledge-publish.cjs');
const { getOpenAIConfig, askOpenAI } = require('../_shared/openai-client.cjs');
const { NEO_SYSTEM_INSTRUCTIONS, OUT_OF_SCOPE_MESSAGE, classifyQuestion } = require('../_shared/neo-persona.cjs');

const MAX_QUESTION_LENGTH = 1000;

function send(context, status, body) {
  context.res = { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body };
}

function parseBody(body) {
  if (body == null || body === '') return {};
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

function makeContext(results, maxChars) {
  const entries = [];
  let total = 0;
  for (const result of results) {
    const text = String(result.text ?? '');
    const entry = `[fragmentId=${result.fragmentId}] [document=${result.document}] [page=${result.page ?? 'unknown'}]\n${text}`;
    if (total + entry.length > maxChars) break;
    entries.push(entry);
    total += entry.length;
  }
  return entries.join('\n\n');
}

function validateModelAnswer(data, results) {
  if (!data || typeof data.answer !== 'string' || !Array.isArray(data.references)) return null;
  const allowed = new Map(results.map((result) => [`${result.document}\0${result.fragmentId}`, result]));
  const references = [];
  for (const reference of data.references) {
    if (!reference || typeof reference.document !== 'string' || typeof reference.fragmentId !== 'string') continue;
    const result = allowed.get(`${reference.document}\0${reference.fragmentId}`);
    if (!result) continue;
    if (!references.some((item) => item.fragmentId === result.fragmentId && item.document === result.document)) {
      references.push({ document: result.document, fragmentId: result.fragmentId, page: result.page ?? null });
    }
  }
  const answerStatus = data.answerStatus === 'answered' && references.length > 0 ? 'answered' : 'insufficient-evidence';
  return { answer: answerStatus === 'answered' ? data.answer : 'La documentación disponible no permite responder con suficiente evidencia.', references, sourceCount: references.length, answerStatus };
}

module.exports = async function knowledgeAsk(context, req) {
  const principal = getPrincipalFromRequest(req);
  if (!principal) return send(context, 401, { ok: false, answerStatus: 'authentication-required' });
  if (!isAdminPrincipal(principal)) return send(context, 403, { ok: false, answerStatus: 'admin-access-required' });

  const body = parseBody(req?.body);
  if (!body) return send(context, 400, { ok: false, answerStatus: 'invalid-request' });
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return send(context, 400, { ok: false, answerStatus: 'question-required' });
  if (question.length > MAX_QUESTION_LENGTH) return send(context, 400, { ok: false, answerStatus: 'question-too-long' });
  if (classifyQuestion(question) === 'out-of-scope') return send(context, 200, { ok: true, answer: OUT_OF_SCOPE_MESSAGE, references: [], sourceCount: 0, answerStatus: 'out-of-scope' });
  if (!knowledgeIndex.getIndexReadStorageConfig().configured) return send(context, 503, { ok: false, answerStatus: 'storage-not-configured' });

  try {
    const client = knowledgeIndex.createIndexReadContainerClient();
    const { indexes } = await search.loadPublishedIndexes(client);
    const results = search.searchIndexes(indexes, question);
    if (classifyQuestion(question, results) === 'out-of-scope') return send(context, 200, { ok: true, answer: OUT_OF_SCOPE_MESSAGE, references: [], sourceCount: 0, answerStatus: 'out-of-scope' });
    if (!results.length) return send(context, 200, { ok: true, answer: 'La documentación disponible no contiene información suficiente para responder.', references: [], sourceCount: 0, answerStatus: 'insufficient-evidence' });
    const config = getOpenAIConfig();
    const contextText = makeContext(results, config.maxContextChars);
    if (!contextText) return send(context, 200, { ok: true, answer: 'La documentación disponible no contiene información suficiente para responder.', references: [], sourceCount: 0, answerStatus: 'insufficient-evidence' });
    const modelResponse = await askOpenAI({ question, context: contextText, instructions: NEO_SYSTEM_INSTRUCTIONS, config, log: context.log });
    const answer = validateModelAnswer(modelResponse.data, results);
    if (!answer) return send(context, 502, { ok: false, answerStatus: 'invalid-model-response' });
    context.log?.(`[knowledge-ask] completed resultCount=${results.length} sourceCount=${answer.sourceCount} inputTokens=${Number(modelResponse.usage?.input_tokens ?? 0)} outputTokens=${Number(modelResponse.usage?.output_tokens ?? 0)}`);
    return send(context, 200, { ok: true, ...answer });
  } catch (error) {
    const status = error?.code === 'OPENAI_NOT_CONFIGURED' ? 'openai-not-configured' : error?.code === 'TIMEOUT' ? 'openai-timeout' : error?.code === 'RATE_LIMITED' ? 'openai-rate-limited' : error?.code === 'AUTHENTICATION' ? 'openai-authentication-error' : error?.code === 'INVALID_RESPONSE' || error?.code === 'OPENAI_INVALID_RESPONSE' ? 'openai-invalid-response' : error?.code === 'MANIFEST_INVALID' ? 'manifest-invalid' : error?.code === 'SEARCH_INDEX_INVALID' ? 'index-invalid' : 'storage-error';
    context.log?.(`[knowledge-ask] ${status === 'storage-error' ? JSON.stringify(getStorageErrorDetails(error, 'knowledge-ask-read')) : status}`);
    return send(context, status === 'storage-error' ? 503 : 502, { ok: false, answerStatus: status });
  }
};

module.exports.parseBody = parseBody;
module.exports.validateModelAnswer = validateModelAnswer;
module.exports.makeContext = makeContext;
