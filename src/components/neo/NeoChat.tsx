import { ChevronDown, LoaderCircle, Maximize2, Send, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import { useNeoConversation, type NeoMessage } from '../../context/NeoConversationContext';
import { useAuthSession } from '../../context/AuthSessionContext';
import { canAccessNeo } from '../../lib/neoAccess';
import { NeoAvatar } from './NeoAvatar';
import floatingIsotype from '../../assets/neo-floating-isotype-light.png';

const SUGGESTIONS = ['¿Qué puedes hacer por mí?', '¿Cuáles son nuestras 5 C?', '¿Qué es un nudge y cómo lo aplicamos?', '¿Qué servicios ofrece Neovantas?', '¿Cuáles son las condiciones de teletrabajo?'];

function documentName(path: string) {
  const name = path.split('/').pop() ?? path;
  try { return decodeURIComponent(name); } catch { return name; }
}

function renderInlineMarkdown(text: string) {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;
  return text.split(pattern).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link && /^https:\/\/(www\.)?neovantas\.com(\/|$)/i.test(link[2])) return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-semibold text-neovantas-blue underline">{link[1]}</a>;
    return <span key={index}>{part}</span>;
  });
}

function BasicMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return <div className="space-y-3">{blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const list = lines.every((line) => /^[-*]\s+/.test(line));
    return list ? <ul key={index} className="list-disc space-y-1 pl-5">{lines.map((line) => <li key={line}>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>)}</ul> : <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex ? <br /> : null}{renderInlineMarkdown(line)}</span>)}</p>;
  })}</div>;
}

function ConversationMessage({ message }: { message: NeoMessage }) {
  const sources = [...new Map((message.response?.references ?? []).map((reference) => [reference.document, reference])).values()];
  const identity = message.response?.answerType === 'corporate-identity';
  return <article className="space-y-3">
    <div className="rounded-xl bg-neovantas-navy px-4 py-3 text-sm leading-6 text-white">{message.question}</div>
    <div className="flex items-start gap-2">
      <NeoAvatar size="message" />
      <div className="min-w-0 flex-1 rounded-xl border border-neovantas-line bg-[#fbfdff] px-4 py-4 text-sm leading-7 text-neovantas-ink">
        {message.error ? <span className="text-[#9a3412]">No se pudo completar esta consulta.</span> : message.response ? <>
          <div className={message.response.answerStatus !== 'answered' ? 'text-neovantas-muted' : ''}><BasicMarkdown text={message.response.answer ?? ''} /></div>
          {sources.length ? <div className="mt-4 border-t border-neovantas-line pt-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-neovantas-muted">{identity ? 'Identidad de Neo' : 'Fuentes documentales'}</p><ul className="mt-2 space-y-1 text-sm text-neovantas-blue">{sources.map((source) => <li key={source.document}>{identity ? 'Cultura corporativa de Neovantas' : documentName(source.document)}{!identity && source.page ? ` · pág. ${source.page}` : ''}</li>)}</ul></div> : null}
        </> : <span className="text-neovantas-muted">Preparando respuesta...</span>}
      </div>
    </div>
  </article>;
}

export function NeoChat({ mode = 'full', onMinimize, onClose }: { mode?: 'full' | 'floating'; onMinimize?: () => void; onClose?: () => void }) {
  const { authChecked, clientPrincipal } = useAuthSession();
  const { question, setQuestion, messages, loading, error, ask } = useNeoConversation();
  const isFloating = mode === 'floating';
  if (!authChecked) return <div className="p-5 text-sm text-neovantas-muted">Comprobando permisos...</div>;
  if (!canAccessNeo(clientPrincipal)) return <div className="p-5 text-sm text-neovantas-muted"><ShieldAlert className="mr-2 inline h-4 w-4 text-[#b45309]" />Acceso restringido.</div>;
  return <section className={isFloating ? 'flex h-full min-h-0 flex-col' : 'overflow-hidden rounded-2xl border border-neovantas-line bg-white shadow-panel'} aria-label="Neo, asistente de Neovantas">
    <div className="flex items-start gap-3 border-b border-neovantas-line bg-neovantas-mist px-4 py-3">
      <NeoAvatar size="header" />
      <div className="min-w-0 flex-1"><h2 className="font-display text-lg text-neovantas-navy">¡Hola! Soy Neo</h2><p className="mt-1 text-sm leading-5 text-neovantas-muted">Tu compañero digital en Neovantas.</p></div>
      {isFloating ? <div className="flex shrink-0 gap-1"><button type="button" aria-label="Abrir Neo en pantalla completa" title="Abrir en pantalla completa" onClick={() => { onClose?.(); window.history.pushState({}, '', '/neo'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-neovantas-muted hover:bg-white hover:text-neovantas-blue"><Maximize2 className="h-4 w-4" /></button><button type="button" aria-label="Minimizar Neo" onClick={onMinimize} className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-neovantas-muted hover:bg-white hover:text-neovantas-blue"><ChevronDown className="h-4 w-4" /></button><button type="button" aria-label="Cerrar Neo" onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-neovantas-muted hover:bg-white hover:text-neovantas-blue"><X className="h-4 w-4" /></button></div> : null}
    </div>
    <div className={isFloating ? 'flex min-h-0 flex-1 flex-col' : ''}>
      <div className={`space-y-4 overflow-y-auto p-4 md:p-5 ${isFloating ? 'min-h-0 flex-1' : ''}`} aria-live="polite">{messages.length ? messages.map((message) => <ConversationMessage key={message.id} message={message} />) : <div className="rounded-xl border border-dashed border-neovantas-line p-5 text-center text-sm text-neovantas-muted">Estoy aquí para ayudarte a encontrar información, resolver dudas y explorar ideas. ¿En qué trabajamos hoy?</div>}{loading ? <div className="flex items-center gap-2 text-sm text-neovantas-muted"><LoaderCircle className="h-4 w-4 animate-spin text-neovantas-blue" />Neo está pensando...</div> : null}{error ? <p role="alert" className="rounded-lg bg-[#fff4ed] px-4 py-3 text-sm text-[#9a3412]">No se pudo completar la consulta. Inténtalo de nuevo.</p> : null}{!messages.length ? <div className="flex flex-wrap gap-2" aria-label="Preguntas sugeridas">{SUGGESTIONS.map((item) => <button type="button" key={item} onClick={() => setQuestion(item)} disabled={loading} className="focus-ring rounded-full border border-neovantas-line bg-white px-3 py-2 text-left text-xs font-semibold text-neovantas-blue hover:border-neovantas-blue hover:bg-[#eef6ff] disabled:opacity-50">{item}</button>)}</div> : null}</div>
      <form onSubmit={ask} className="flex flex-col gap-3 border-t border-neovantas-line bg-white p-4 sm:flex-row sm:items-end"><textarea aria-label="Pregunta para Neo" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={isFloating ? 2 : 3} placeholder="Escribe tu pregunta..." className="focus-ring min-w-0 flex-1 resize-none rounded-xl border border-neovantas-line px-4 py-3 text-sm outline-none placeholder:text-neovantas-muted" /><button type="submit" disabled={loading || !question.trim()} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neovantas-blue px-5 text-sm font-semibold text-white hover:bg-neovantas-navy disabled:opacity-50"><Send className="h-4 w-4" />Enviar</button></form>
    </div>
  </section>;
}

export function NeoFloatingAssistant() {
  const { authChecked, clientPrincipal } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  if (!authChecked || !canAccessNeo(clientPrincipal)) return null;
  return <div className="fixed bottom-5 right-5 z-40 md:bottom-7 md:right-7"><button type="button" aria-label="Pregúntale a Neo" title="Pregúntale a Neo" onClick={() => { setOpen(true); setMinimized(false); }} className="focus-ring grid h-14 w-14 place-items-center rounded-full bg-neovantas-navy text-white shadow-[0_12px_30px_rgba(10,10,63,0.3)] transition hover:scale-105 hover:bg-neovantas-blue"><img src={floatingIsotype} alt="Neo" className="h-10 w-10 object-contain" /></button>{open && !minimized ? <div className="absolute bottom-[4.5rem] right-0 h-[min(600px,calc(100vh-13rem))] max-h-[calc(100vh-13rem)] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-neovantas-line bg-white shadow-[0_24px_70px_rgba(10,10,63,0.25)]"><NeoChat mode="floating" onMinimize={() => setMinimized(true)} onClose={() => setOpen(false)} /></div> : null}</div>;
}
