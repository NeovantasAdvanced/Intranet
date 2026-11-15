import { NeoChat } from '../components/neo/NeoChat';
import { SectionHeader } from '../components/ui/SectionHeader';

export function NeoPage() {
  return <div className="space-y-7"><SectionHeader title="Neo, tu compañero digital" description="Conocimiento, ideas y ayuda para el día a día en Neovantas." /><NeoChat mode="full" /><p className="flex items-center justify-center gap-2 text-xs text-neovantas-muted">Neo utiliza el contexto reciente de esta conversación; el historial se mantiene en memoria durante esta sesión.</p></div>;
}
