import assert from 'node:assert/strict';
import { selectNewsMessageSubjects } from '../sync-outlook-news.mjs';

const messages = [
  {
    subject: 'Noticias People de hoy',
    receivedDateTime: '2026-06-01T08:00:00Z',
    from: { emailAddress: { address: 'advanced.analytics@neovantas.com' } },
  },
  {
    subject: 'Noticias relevantes de hoy - 01 junio 2026',
    receivedDateTime: '2026-06-01T09:00:00Z',
    from: { emailAddress: { address: 'advanced.analytics@neovantas.com' } },
  },
  {
    subject: 'Noticias relevantes de hoy - 31 mayo 2026',
    receivedDateTime: '2026-05-31T09:00:00Z',
    from: { emailAddress: { address: 'advanced.analytics@neovantas.com' } },
  },
];

const selected = selectNewsMessageSubjects(
  messages,
  'Noticias relevantes de hoy',
  'advanced.analytics@neovantas.com',
);

assert.equal(selected.length, 2);
assert.equal(selected[0].subject, 'Noticias relevantes de hoy - 01 junio 2026');
assert.equal(selected[1].subject, 'Noticias relevantes de hoy - 31 mayo 2026');

console.log('News subject selection fixture passed.');
