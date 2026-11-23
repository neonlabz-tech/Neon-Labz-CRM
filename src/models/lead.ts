import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const LEAD_STAGES = ["New", "Connected", "Interested", "Quotation Sent", "Demo Scheduled", "Payment Promised", "Follow-up", "Converted", "Lost"] as const;
export const LEAD_SOURCES = ["Google Maps", "Facebook", "Instagram", "TikTok", "Referral", "Website", "Other"] as const;
export const LEAD_SERVICES = ["Software development", "Marketing", "Both"] as const;
export const CALL_OUTCOMES = ["Answered", "Not Answered"] as const;

const call = new mongoose.Schema(
  {
    date: String,
    outcome: { type: String, enum: CALL_OUTCOMES, default: "Answered" },
    status: { type: String, enum: LEAD_STAGES, default: "New" },
    next: { type: String, default: "" },
    note: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    leadId: { type: String, required: true, unique: true },
    owner: { type: String, required: true, index: true },
    /** True for leads the Super Admin adds under "Own projects"; those never show in the SD (sales team) list. */
    own: { type: Boolean, default: false },
    date: { type: String, required: true },
    business: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    phoneDigits: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    businessType: { type: String, default: "" },
    source: { type: String, enum: LEAD_SOURCES, default: "Other" },
    service: { type: String, enum: LEAD_SERVICES, default: "Software development" },
    status: { type: String, enum: LEAD_STAGES, default: "New" },
    next: { type: String, default: "" },
    notes: { type: String, default: "" },
    clientCode: { type: String, default: "" },
    latestFollowUpAt: { type: Date, default: null },
    calls: { type: [call], default: [] },
  },
  { timestamps: true }
);
// One phone number per lead, one client code per client.
schema.index({ phoneDigits: 1 }, { unique: true, partialFilterExpression: { phoneDigits: { $gt: "" } } });
schema.index({ clientCode: 1 }, { unique: true, partialFilterExpression: { clientCode: { $gt: "" } } });
schema.index({ owner: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, next: 1 });
schema.index({ createdAt: -1 });

export type LeadDoc = InferSchemaType<typeof schema>;
const cachedLead = mongoose.models.Lead as Model<LeadDoc> | undefined;
if (process.env.NODE_ENV !== "production" && cachedLead && !cachedLead.schema.path("own")) mongoose.deleteModel("Lead");
export const Lead: Model<LeadDoc> = (mongoose.models.Lead as Model<LeadDoc>) || mongoose.model<LeadDoc>("Lead", schema);
