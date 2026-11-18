import { Phone, Trophy, UserPlus } from "lucide-react";

const bar = (value: number) => (
  <div className="h-2.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-white/90" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
);

function Goal({ title, done, goal, unit, icon, tint, month = false }: { title: string; done: number; goal: number; unit: string; icon: React.ReactNode; tint: string; month?: boolean }) {
  const percent = goal ? Math.min(100, Math.round((100 * done) / goal)) : 0;
  return (
    <article className={`rounded-2xl p-5 text-white shadow-sm ${tint}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-extrabold">{done}<span className="text-base font-medium text-white/80"> / {goal || "—"} {unit}</span></p>
      <div className="mt-3">{bar(percent)}</div>
      <p className="mt-2 text-xs text-white/85">{goal ? (done >= goal ? (month ? "Target reached. Great work!" : "Goal smashed today. Great work!") : month ? `${goal - done}% more to reach your monthly target.` : `Only ${goal - done} more to hit today's goal.`) : month ? "No monthly target set yet." : "No daily goal set yet."}</p>
    </article>
  );
}

/** The monthly target and today's lead and call goals, as three coloured cards. */
export function GoalCards({ monthPercent, hasTarget, leads, leadGoal, calls, callGoal }: { monthPercent: number; hasTarget: boolean; leads: number; leadGoal: number; calls: number; callGoal: number }) {
  return (
    <>
      <h2 className="mb-3 font-semibold">Your goals</h2>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Goal month title="Monthly sales" done={monthPercent} goal={hasTarget ? 100 : 0} unit="%" icon={<Trophy />} tint="bg-gradient-to-br from-[#4F46E5] to-[#7C6CFF]" />
        <Goal title="New leads today" done={leads} goal={leadGoal} unit="leads" icon={<UserPlus />} tint="bg-gradient-to-br from-[#F59E0B] to-[#F97316]" />
        <Goal title="Answered calls today" done={calls} goal={callGoal} unit="calls" icon={<Phone />} tint="bg-gradient-to-br from-[#EC4899] to-[#F43F5E]" />
      </div>
    </>
  );
}
