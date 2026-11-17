export const SOCIALS = ["email", "facebook", "instagram", "tiktok", "youtube", "linkedin"] as const;
export type Social = (typeof SOCIALS)[number];
export const SOCIAL_LABEL: Record<Social, string> = { email: "Email", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn" };
export const POST_TYPES = ["Poster", "Reel"] as const;
export const POST_STATUS = ["Pending", "Completed"] as const;

export const INFO_FIELDS = [
  ["brandName", "Brand name"], ["legalName", "Legal name"], ["industry", "Industry"], ["tagline", "Tagline"],
  ["mainContactName", "Main contact"], ["mainContactTitle", "Main contact title"],
  ["assignedContactName", "Assigned contact"], ["assignedContactTitle", "Assigned contact title"],
  ["email", "Email"], ["phone", "Phone"], ["website", "Website"], ["address", "Address"],
  ["hours", "Business hours"], ["preferredContact", "Preferred way to contact"],
  ["primaryColor", "Main brand colour"], ["secondaryColors", "Other brand colours"], ["fonts", "Brand fonts"],
] as const;
type InfoField = (typeof INFO_FIELDS)[number][0];

export const REPORT_PLATFORMS = [
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"],
] as const;
export type ReportRow = { label: string; value: string };
export type ReportPost = { title: string; views: string };
export type ReportShot = { url: string; caption: string };
export type PlatformData = { intro: string; metrics: ReportRow[]; analysis: string; posts: ReportPost[]; audience: ReportRow[]; shots: ReportShot[] };

export const emptyPlatform = (): PlatformData => ({ intro: "", metrics: [], analysis: "", posts: [], audience: [], shots: [] });

/** Metric names the form offers for each platform, so the team only types the values. */
export const METRIC_PRESETS: Record<string, string[]> = {
  facebook: ["Views", "Viewers", "Content interactions", "Facebook visits", "3-second video views", "Watch time", "Follows / net follows", "Paid views", "Views from followers", "Views from non-followers"],
  instagram: ["Views", "Reach", "Content interactions", "Paid views", "Views from organic", "Views from ads", "Profile visits", "Net follows"],
  tiktok: ["Video views", "Profile views", "Likes", "Comments", "Shares", "Total viewers", "New viewers", "Net followers", "For You traffic", "Search traffic", "Total followers (all time)"],
  youtube: ["Views", "Watch time", "Impressions", "Subscribers gained", "Likes", "Comments", "Shares", "Average view duration"],
  linkedin: ["Impressions", "Reactions", "Comments", "Reposts", "Page views", "Clicks", "Followers gained"],
};
export const AUDIENCE_PRESETS = ["Total viewers", "New viewers", "Total followers", "Gender distribution", "Most active time", "Top location", "Age range"];

/** Does this platform have anything worth printing? */
export function platformHasData(data: Partial<PlatformData> | undefined | null): boolean {
  if (!data) return false;
  return Boolean(
    data.intro?.trim() || data.analysis?.trim() || data.metrics?.some((m) => m.label.trim() && m.value.trim()) ||
    data.posts?.some((p) => p.title.trim()) || data.audience?.some((a) => a.label.trim() && a.value.trim()) || data.shots?.some((s) => s.url)
  );
}
