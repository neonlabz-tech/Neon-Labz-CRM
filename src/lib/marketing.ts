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
type ReportPlatform = (typeof REPORT_PLATFORMS)[number][0];

type StatField = readonly [key: string, label: string, area?: true];
export const STAT_SECTIONS: readonly { title: string; fields: readonly StatField[] }[] = [
  {
    title: "Performance overview",
    fields: [
      ["overview", "Overview", true], ["totalViews", "Total views"], ["viewers", "Viewers"], ["visits", "Visits"],
      ["interactions", "Content interactions"], ["videoViews", "Three-second video views"], ["watchTime", "Watch time"],
      ["newFollowers", "New followers"], ["conversations", "Conversations started"],
    ],
  },
  { title: "Audience reach", fields: [["nonFollowerPercent", "Non-follower views %"], ["followerPercent", "Follower views %"], ["audienceNote", "Audience note", true]] },
  {
    title: "Content performance",
    fields: [
      ["contentIntro", "Content summary", true], ["reelsViews", "Reels views"], ["photoViews", "Photo views"],
      ["contentInteractions", "Content interactions"], ["photoInteractions", "Photo interactions"],
      ["reelsInteractions", "Reels interactions"], ["storiesInteractions", "Stories interactions"], ["videoNote", "Video performance", true],
    ],
  },
];
export const STAT_KEYS = STAT_SECTIONS.flatMap((s) => s.fields.map((f) => f[0]));
