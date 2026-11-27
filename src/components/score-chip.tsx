import { Suspense } from "react";
import { ScoreChipMenu } from "@/components/score-chip-menu";
import { companyStandings, LEAVE_PENALTY, STANDINGS_DAYS } from "@/lib/productivity";

/** The people who work to a score. The Super Admin sees everyone's on the Productivity page instead. */
const ROLES = ["employee", "sales", "pm", "marketing"];

async function Loaded({ username }: { username: string }) {
  const all = await companyStandings();
  const me = all.find((r) => r.username === username);
  if (!me) return null;
  const third = all.find((r) => r.rank === 3)?.score ?? null;
  return <ScoreChipMenu d={{ score: me.score, rank: me.rank, of: all.length, team: me.team, left: me.left, converted: me.converted, leave: me.leave, nonApproved: me.nonApproved, thirdScore: third, days: STANDINGS_DAYS, penalty: LEAVE_PENALTY }} />;
}

/** Beside the bell. Streams in after the page, so working it out never holds the page back. Shown only to the people who have a score. */
export function ScoreChip({ username, role }: { username: string; role: string }) {
  if (!ROLES.includes(role)) return null;
  return (
    <Suspense fallback={null}>
      <Loaded username={username} />
    </Suspense>
  );
}
