import assert from 'node:assert/strict';
import {
  isInboxLikeFolderName,
  sameFolderName,
  splitFolderReference,
} from '../outlook-graph-utils.mjs';

assert.deepEqual(splitFolderReference('Bandeja de entrada / Neovantas'), ['Bandeja de entrada', 'Neovantas']);
assert.deepEqual(splitFolderReference('inbox\\Neovantas'), ['inbox', 'Neovantas']);
assert.ok(isInboxLikeFolderName('Inbox'));
assert.ok(isInboxLikeFolderName('Bandeja de entrada'));
assert.ok(sameFolderName('Neóvantas', 'neovantas'));
assert.ok(sameFolderName('  Neovantas  ', 'neovantas'));

console.log('Folder normalization fixture passed.');
