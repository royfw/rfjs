export function FragmentBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 font-mono text-[11px] text-primary">
      {children}
    </div>
  );
}
