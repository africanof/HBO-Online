/** Caixas cinzentas que «respiram» enquanto os cartões carregam. */
export function SkeletonCards({ n = 8, className = "results-grid" }: { n?: number; className?: string }) {
  return <div className={className} aria-hidden="true">
    {Array.from({ length: n }, (_, i) => <div key={i} className="sk-card"><div className="sk sk-img" /><div className="sk sk-line" /><div className="sk sk-line short" /><div className="sk sk-line tiny" /></div>)}
  </div>;
}
