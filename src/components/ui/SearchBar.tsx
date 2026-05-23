import { Search } from 'lucide-react';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar en el portal',
  className = '',
}: SearchBarProps) {
  return (
    <label
      className={`flex h-11 min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 shadow-sm transition focus-within:border-neovantas-blue focus-within:ring-2 focus-within:ring-neovantas-blue/15 ${className}`}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Buscar</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        placeholder={placeholder}
        type="search"
      />
    </label>
  );
}
