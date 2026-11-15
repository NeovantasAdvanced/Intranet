const assert = require('node:assert/strict');
const persona = require('../_shared/neo-persona.cjs');
const publicSearch = require('../_shared/public-knowledge-search.cjs');
const ask = require('../knowledge-ask/index.cjs');

const indexes = [
  { document: 'https://www.neovantas.com/quienes-somos', title: 'Quiénes somos', url: 'https://www.neovantas.com/quienes-somos', sourceType: 'corporate-web', chunks: [{ id: 'who', text: 'Neovantas es una consultora especializada en Behavioral Economics y transformación de negocios.', position: 0 }] },
  { document: 'https://www.neovantas.com/que-hacemos', title: 'Qué hacemos', url: 'https://www.neovantas.com/que-hacemos', sourceType: 'corporate-web', chunks: [{ id: 'what', text: 'Aplicamos Economía Conductual, analítica y diseño de experiencias para ayudar a organizaciones y entidades financieras.', position: 0 }] },
];

(async () => {
  assert.equal(persona.classifyQuestion('¿Qué es Neovantas y a qué se dedica?'), 'corporate-identity');
  assert.equal(persona.classifyQuestion('¿Qué servicios ofrece Neovantas a las entidades financieras?'), 'corporate-identity');
  assert.equal(persona.classifyQuestion('¿Cómo aplica Neovantas la Economía Conductual?'), 'corporate-identity');
  assert.equal(persona.classifyQuestion('¿Qué es un nudge?'), 'general');
  assert.equal(persona.isIdentityQuestion('¿Y qué servicios ofrecemos?', [{ role: 'user', content: 'Hablábamos de Neovantas' }]), true);
  assert.equal(persona.isCorporateFollowUp('¿Y qué hace en seguros?', [{ role: 'user', content: '¿Qué es Neovantas?' }]), true);
  assert.equal(persona.isCorporateFollowUp('¿Y en banca?', [{ role: 'user', content: '¿Qué servicios ofrece Neovantas?' }]), true);
  assert.equal(persona.isCorporateFollowUp('¿Qué es la regresión logística?', [{ role: 'user', content: '¿Qué es Neovantas?' }]), false);
  assert.equal(ask.buildRetrievalQuestion('¿Y qué hace en seguros?', [{ role: 'user', content: '¿Qué es Neovantas?' }]), '¿Y qué hace en seguros? Neovantas servicios soluciones que hacemos');
  assert.equal(ask.buildRetrievalQuestion('¿Qué es la regresión logística?', [{ role: 'user', content: '¿Qué es Neovantas?' }]), '¿Qué es la regresión logística?');
  assert.equal(publicSearch.searchPublicIndexes(indexes, '¿Qué es Neovantas?')[0].url, 'https://www.neovantas.com/quienes-somos');
  assert.equal(publicSearch.searchPublicIndexes(indexes, '¿Qué servicios ofrece Neovantas?')[0].url, 'https://www.neovantas.com/que-hacemos');
  assert.equal(publicSearch.searchPublicIndexes(indexes, ask.buildRetrievalQuestion('¿Y qué hace en seguros?', [{ role: 'user', content: '¿Qué es Neovantas?' }]))[0].url, 'https://www.neovantas.com/que-hacemos');
  const instructions = ask.makeRequestInstructions('corporate-web'); assert.match(instructions, /No completes listas de pa[ií]ses/);
  const valid = ask.validateModelAnswer({ answer: 'La web indica presencia internacional, pero no enumera países.', references: [{ document: indexes[0].document, fragmentId: 'who' }], answerStatus: 'answered', answerType: 'corporate-web' }, [{ ...indexes[0].chunks[0], document: indexes[0].document, fragmentId: 'who', sourceType: 'corporate-web', title: indexes[0].title, url: indexes[0].url }], 'corporate-web');
  assert.equal(valid.answerStatus, 'answered'); assert.equal(valid.references[0].sourceType, 'corporate-web');
  const noEvidence = ask.validateModelAnswer({ answer: 'España, Portugal y México.', references: [], answerStatus: 'answered', answerType: 'corporate-web' }, [], 'corporate-web');
  assert.equal(noEvidence.answerStatus, 'insufficient-evidence'); assert.equal(noEvidence.sourceCount, 0);
  console.log('neo corporate routing tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
