export function BrandMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return <div className="flex min-w-0 items-center gap-2 font-semibold">
    {logoUrl ? <img src={logoUrl} alt={`הלוגו של ${name}`} className="h-10 w-16 shrink-0 rounded bg-white object-contain p-1" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>{name.slice(0, 1)}</span>}
    <bdi className="truncate" title={name}>{name}</bdi>
  </div>;
}
