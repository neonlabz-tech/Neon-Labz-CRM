/** The header across the top of every page on desktop: a greeting on the left and the bell on the right. The account and search live in the sidebar. */
export function TopBar({ name, today, bell, chip }: { name: string; today: string; bell: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-line bg-white/90 px-8 py-3 backdrop-blur lg:flex">
      <div>
        <p className="text-sm font-semibold">Welcome back, {name.split(" ")[0]}</p>
        <p className="text-xs text-muted">{today}</p>
      </div>
      <div className="flex items-center gap-3">{chip}{bell}</div>
    </header>
  );
}
