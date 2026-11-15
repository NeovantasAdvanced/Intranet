const assert = require('node:assert/strict');
const persona = require('../_shared/neo-persona.cjs');
const knowledgeIndex = require('../_shared/knowledge-index.cjs');
const search = require('../_shared/knowledge-search.cjs');

const admin = Buffer.from(JSON.stringify({ userDetails: 'admin@neovantas.com', userRoles: ['admin'], claims: [] })).toString('base64');

async function run() {
  assert.equal(persona.classifyScope('¿Cómo se hace una paella?'), 'out-of-scope');
  assert.equal(persona.classifyScope('Recomiéndame una serie para esta noche'), 'out-of-scope');
  assert.equal(persona.classifyScope('¿Cómo puedo arreglar el grifo de mi casa?'), 'out-of-scope');
  assert.equal(persona.classifyScope('¿Qué puedo hacer este fin de semana?'), 'out-of-scope');

  for (const question of [
    '¿Qué es Neovantas?',
    '¿Cuáles son las condiciones de teletrabajo?',
    '¿Qué es un nudge?',
    '¿Cómo mejorar la conversión comercial de un banco?',
    '¿Cómo crear una tabla dinámica en Excel?',
    '¿Qué es un agente de IA?',
    '¿Cómo preparar una presentación para un cliente?',
    '¿Cómo organizar una comida de equipo?',
  ]) assert.equal(persona.classifyScope(question), 'in-scope', question);

  assert.equal(persona.classifyScope('¿Y cómo lo aplicaríamos?', [{ role: 'user', content: 'Hablábamos de un proyecto para un cliente bancario.' }]), 'in-scope');
  assert.equal(persona.classifyScope('¿Qué menú recomendarías?', [{ role: 'user', content: 'Estamos preparando un evento corporativo.' }]), 'in-scope');
  assert.equal(persona.classifyScope('¿Qué significa esto?'), 'ambiguous');

  const originalConfig = knowledgeIndex.getIndexReadStorageConfig;
  const originalLoad = search.loadPublishedIndexes;
  let loaded = false;
  knowledgeIndex.getIndexReadStorageConfig = () => ({ configured: true });
  search.loadPublishedIndexes = async () => { loaded = true; throw new Error('out-of-scope must not load indexes'); };
  const endpoint = require('../knowledge-ask/index.cjs');
  for (const question of ['¿Cómo se hace una paella?', '¿Qué puedo hacer este fin de semana?']) {
    const context = { res: null, log() {} };
    await endpoint(context, { headers: { 'x-ms-client-principal': admin }, body: { question } });
    assert.equal(context.res.status, 200);
    assert.equal(context.res.body.answerStatus, 'out-of-scope');
    assert.equal(context.res.body.ok, true);
  }
  assert.equal(loaded, false, 'out-of-scope queries must not load document indexes');
  knowledgeIndex.getIndexReadStorageConfig = originalConfig;
  search.loadPublishedIndexes = originalLoad;
  console.log('neo scope tests passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
