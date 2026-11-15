import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';

export type Reference = { document: string; page?: number | null; url?: string };
export type ResponsePayload = { answer?: string; answerStatus?: string; answerType?: string; references?: Reference[] };
export type NeoMessage = { id: number; question: string; response?: ResponsePayload; error?: boolean };

type NeoConversationContextValue = {
  question: string;
  setQuestion: (value: string) => void;
  messages: NeoMessage[];
  loading: boolean;
  error: boolean;
  ask: (event?: FormEvent) => Promise<void>;
};

const NeoConversationContext = createContext<NeoConversationContextValue | null>(null);

export function NeoConversationProvider({ children }: { children: ReactNode }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<NeoMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (!value || loading) return;
    const id = Date.now();
    const history = messages.slice(-6).flatMap((item) => [
      { role: 'user', content: item.question },
      ...(item.response?.answer ? [{ role: 'assistant', content: item.response.answer }] : []),
    ]);
    setQuestion('');
    setError(false);
    setLoading(true);
    setMessages((current) => [...current, { id, question: value }]);
    try {
      const response = await fetch('/api/knowledge-ask', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: value, messages: history.slice(-6) }),
      });
      const payload = await response.json() as ResponsePayload;
      if (!response.ok) throw new Error('request-failed');
      setMessages((current) => current.map((item) => item.id === id ? { ...item, response: payload } : item));
    } catch {
      setError(true);
      setMessages((current) => current.map((item) => item.id === id ? { ...item, error: true } : item));
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo(() => ({ question, setQuestion, messages, loading, error, ask }), [question, messages, loading, error]);
  return <NeoConversationContext.Provider value={value}>{children}</NeoConversationContext.Provider>;
}

export function useNeoConversation() {
  const context = useContext(NeoConversationContext);
  if (!context) throw new Error('useNeoConversation must be used inside NeoConversationProvider');
  return context;
}
