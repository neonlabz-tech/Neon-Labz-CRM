/** Shared by the Content Tracker page, its table and its server actions. */
export const APPROVAL_STATUS = ["Pending", "Approved"] as const;
export const PUBLISH_STATUS = ["Pending", "Approved"] as const;
export type TrackStatus = (typeof APPROVAL_STATUS)[number];

/** Content types offered the first time the tracker is used. The team can add more from the dropdown itself. */
export const DEFAULT_CONTENT_TYPES = ["Awareness", "Engagement", "Promotional", "Educational", "Lead generation", "Brand story", "Festive / Seasonal"] as const;

/** The value of the "add a new type" entry at the bottom of the Content Type dropdown. */
export const NEW_TYPE = "__new__";

export const TRACK_FIELDS = ["contentType", "assignee", "caption", "approval", "scheduleDate", "publishStatus"] as const;
export type TrackField = (typeof TRACK_FIELDS)[number];

/** A few emojis for the caption box. Typing or pasting any other emoji works too. */
export const EMOJIS = ["😀", "😊", "😍", "🔥", "✨", "🎉", "👍", "🙌", "💯", "❤️", "🚀", "🌟", "📢", "🎯", "💡", "🛍️", "🎁", "⭐", "📸", "🎬", "✅", "📅", "💬", "🙏"] as const;
