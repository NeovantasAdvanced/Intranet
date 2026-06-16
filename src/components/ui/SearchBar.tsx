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
      className={`flex h-11 min-w-0 items-center gap-3 rounded-2xl border border-neovantas-line bg-white px-4 text-neovantas-muted shadow-sm transition focus-within:border-neovantas-blue focus-within:ring-2 focus-within:ring-neovantas-cyan/20 ${className}`}
    >
      <Search className="h-4 w-4 shrink-0 text-neovantas-blue" aria-hidden="true" />
      <span className="sr-only">Buscar</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-neovantas-navy outline-none placeholder:text-neovantas-muted"
        placeholder={placeholder}
        type="search"
      />
    </label>
  );
}
