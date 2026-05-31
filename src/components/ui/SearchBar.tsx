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
      className={`flex h-10 min-w-0 items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 text-white/60 transition focus-within:border-white/30 focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/10 ${className}`}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">Buscar</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
        placeholder={placeholder}
        type="search"
      />
    </label>
  );
}
