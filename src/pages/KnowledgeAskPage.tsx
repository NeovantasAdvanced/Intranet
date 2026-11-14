import { Bot, LoaderCircle, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { SectionHeader } from '../components/ui/SectionHeader';
import { useAuthSession } from '../context/AuthSessionContext';
import { isAdminUser, isOffice365AdminPrincipal } from '../lib/admin';
import { isAdmin as isAdminAllowed } from '../lib/accessControl';

type Reference = { document: string; fragmentId?: string; page?: number | null };
type Answer = { ok: boolean; answer?: string; answerStatus?: string; references?: Reference[]; sourceCount?: number };
type ChatMessage = { id: number; question: string; response?: Answer; error?: boolean };

const SUGGESTIONS = ['¿Cuáles son las condiciones de teletrabajo?', '¿Qué beneficios tienen los empleados?', '¿Qué establece el código ético?'];

function getDocumentName(path: string) {
  const raw = path.split('/').pop() ?? path;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function KnowledgeAskPage() {
  const { authChecked, clientPrincipal } = useAuthSession();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const administrator = useMemo(() => Boolean(clientPrincipal && (isAdminAllowed(clientPrincipal.userDetails) || isAdminUser(clientPrincipal.userDetails) || isOffice365AdminPrincipal(clientPrincipal))), [clientPrincipal]);

  if (!authChecked) return <div className="rounded-2xl border border-neovantas-line bg-white p-8 text-sm text-neovantas-muted">Comprobando permisos...</div>;
  if (!administrator) return <div className="rounded-2xl border border-[#f1d8c8] bg-white p-8 text-center shadow-panel"><ShieldAlert className="mx-auto h-8 w-8 text-[#b45309]" aria-hidden="true" /><h1 className="mt-4 font-display text-2xl text-neovantas-navy">Acceso restringido</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neovantas-muted">El asistente documental está disponible únicamente para administradores autorizados.</p></div>;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (!value || loading) return;
    setQuestion(''); setError(''); setLoading(true);
    const id = Date.now(); setMessages((current) => [...current, { id, question: value }]);
    try {
      const response = await fetch('/api/knowledge-ask', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ question: value }) });
      const payload = (await response.json().catch(() => null)) as Answer | null;
      if (!response.ok || !payload) throw new Error('request-failed');
      setMessages((current) => current.map((message) => message.id === id ? { ...message, response: payload } : message));
    } catch { setError('No se pudo completar la consulta. Inténtalo de nuevo.'); setMessages((current) => current.map((message) => message.id === id ? { ...message, error: true } : message)); }
    finally { setLoading(false); }
  }

  return <div className="space-y-7">
    <SectionHeader title="Asistente documental Neovantas" description="Consulta políticas y documentación corporativa validada mediante fuentes internas." />
    <section className="overflow-hidden rounded-2xl border border-neovantas-line bg-white shadow-panel">
      <div className="flex items-start gap-4 border-b border-neovantas-line bg-neovantas-mist px-5 py-5 md:px-7"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neovantas-blue text-white"><Bot className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="font-display text-xl text-neovantas-navy">Pregúntale a la documentación</h2><p className="mt-1 text-sm leading-6 text-neovantas-muted">Las respuestas se generan únicamente con los documentos corporativos disponibles y muestran sus fuentes.</p></div></div>
      <div className="space-y-5 p-5 md:p-7" aria-live="polite">
        {messages.length === 0 ? <div className="rounded-xl border border-dashed border-neovantas-line p-6 text-center text-sm text-neovantas-muted">Empieza con una pregunta sobre políticas, beneficios o procedimientos internos.</div> : null}
        {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
        {loading ? <div className="flex items-center gap-2 text-sm text-neovantas-muted"><LoaderCircle className="h-4 w-4 animate-spin text-neovantas-blue" aria-hidden="true" />Consultando documentación...</div> : null}
        {error ? <p role="alert" className="rounded-lg bg-[#fff4ed] px-4 py-3 text-sm text-[#9a3412]">{error}</p> : null}
        <div className="flex flex-wrap gap-2" aria-label="Preguntas sugeridas">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" disabled={loading} onClick={() => setQuestion(suggestion)} className="focus-ring rounded-full border border-neovantas-line bg-white px-3 py-2 text-left text-xs font-semibold text-neovantas-blue transition hover:border-neovantas-blue hover:bg-[#eef6ff] disabled:opacity-50">{suggestion}</button>)}</div>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1"><span className="sr-only">Pregunta</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={3} placeholder="Escribe tu pregunta..." className="focus-ring w-full resize-none rounded-xl border border-neovantas-line bg-white px-4 py-3 text-sm leading-6 text-neovantas-ink outline-none placeholder:text-neovantas-muted" /></label><button type="submit" disabled={loading || !question.trim()} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neovantas-blue px-5 text-sm font-semibold text-white transition hover:bg-neovantas-navy disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" />Enviar</button></form>
        <p className="flex items-center gap-2 text-xs text-neovantas-muted"><Sparkles className="h-3.5 w-3.5 text-neovantas-blue" aria-hidden="true" />La conversación se mantiene solo en memoria durante esta sesión.</p>
      </div>
    </section>
  </div>;
}

function ChatMessage({ message }: { message: ChatMessage }) {
  const references = [...new Map((message.response?.references ?? []).map((reference) => [reference.document, reference])).values()];
  return <article className="space-y-3"><div className="rounded-xl bg-neovantas-navy px-4 py-3 text-sm leading-6 text-white">{message.question}</div><div className="rounded-xl border border-neovantas-line bg-[#fbfdff] px-4 py-4 text-sm leading-7 text-neovantas-ink">{message.error ? <p role="alert" className="text-[#9a3412]">No se pudo completar la consulta. Inténtalo de nuevo.</p> : message.response ? <><p className={message.response.answerStatus === 'insufficient-evidence' ? 'text-neovantas-muted' : ''}>{message.response.answer}</p>{references.length ? <div className="mt-4 border-t border-neovantas-line pt-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-neovantas-muted">Fuentes documentales</p><ul className="mt-2 space-y-1 text-sm text-neovantas-blue">{references.map((reference) => <li key={reference.document}>• {getDocumentName(reference.document)}{reference.page ? ` · pág. ${reference.page}` : ''}</li>)}</ul></div> : null}</> : <span className="text-neovantas-muted">Preparando respuesta...</span>}</div></article>;
}
