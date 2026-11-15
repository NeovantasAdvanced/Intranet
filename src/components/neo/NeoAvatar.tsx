import isotype from '../../assets/NEOVANTAS_ISOLOGO_BLUE.png';

export function NeoAvatar({ size = 'message' }: { size?: 'message' | 'header' | 'floating' }) {
  const dimensions = size === 'floating' ? 'h-8 w-8 rounded-full p-1' : size === 'header' ? 'h-11 w-11 rounded-2xl p-1.5' : 'h-8 w-8 rounded-full p-1';
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden bg-white ${dimensions}`}><img src={isotype} alt="Neo" className="h-full w-full object-contain" /></span>;
}
