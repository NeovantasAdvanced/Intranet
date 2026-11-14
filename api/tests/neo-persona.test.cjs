const assert = require('node:assert/strict');
const { NEO_SYSTEM_INSTRUCTIONS, OUT_OF_SCOPE_MESSAGE, classifyQuestion } = require('../_shared/neo-persona.cjs');

assert.match(NEO_SYSTEM_INSTRUCTIONS, /Neo/);
assert.match(NEO_SYSTEM_INSTRUCTIONS, /curiosidad/);
assert.match(NEO_SYSTEM_INSTRUCTIONS, /DATOS DOCUMENTALES/);
assert.equal(classifyQuestion('¿Cuántos días puedo teletrabajar?'), 'in-scope');
assert.equal(classifyQuestion('¿Qué beneficios tenemos?'), 'in-scope');
assert.equal(classifyQuestion('¿Qué establece el código ético?'), 'in-scope');
assert.equal(classifyQuestion('¿Me das una receta de cocina?'), 'out-of-scope');
assert.equal(classifyQuestion('¿Qué significa esto?'), 'in-scope');
assert.match(OUT_OF_SCOPE_MESSAGE, /Neovantas/);
console.log('neo-persona tests passed');
