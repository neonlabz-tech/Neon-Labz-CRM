import mongoose, { type InferSchemaType, type Model } from "mongoose";

const base = {
  owner: { type: String, required: true, index: true },
  projectCode: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  date: { type: String, default: "" },
  pdfUrl: { type: String, default: "" },
};
const t = { type: String, default: "" };

const srs = new mongoose.Schema({ ...base, preparedFor: t, introduction: t, functional: t, nonFunctional: t, assumptions: t }, { timestamps: true });

const proposal = new mongoose.Schema(
  {
    ...base,
    subtitle: t, preparedFor: t, companyScope: t, validity: t, summary: t,
    customerTitle: t, customerRole: t, customerFeatures: t, adminTitle: t, adminRole: t, adminFeatures: t,
    stack: { type: [new mongoose.Schema({ layer: t, technology: t, purpose: t }, { _id: false })], default: [] },
    brand: { type: [new mongoose.Schema({ title: t, text: t }, { _id: false })], default: [] },
    packageName: t, packageInvestment: t,
    packageStats: { type: [new mongoose.Schema({ value: t, label: t }, { _id: false })], default: [] },
    budget: { type: [new mongoose.Schema({ deliverable: t, fee: t, amount: t }, { _id: false })], default: [] },
    totalAmount: t, totalNote: t, duration: t, startDate: t, launchDate: t, terms: t,
    clientSignName: t, clientSignTitle: t, clientSignDate: t, companySignName: t, companySignTitle: t, companySignDate: t,
  },
  { timestamps: true }
);

const video = new mongoose.Schema({ ...base, url: t, notes: t }, { timestamps: true });
for (const schema of [srs, proposal, video]) schema.index({ owner: 1, createdAt: -1 });

export type SrsDoc = InferSchemaType<typeof srs>;
export type ProposalDoc = InferSchemaType<typeof proposal>;
export type VideoDoc = InferSchemaType<typeof video>;
export const Srs: Model<SrsDoc> = (mongoose.models.Srs as Model<SrsDoc>) || mongoose.model<SrsDoc>("Srs", srs);
export const Proposal: Model<ProposalDoc> = (mongoose.models.Proposal as Model<ProposalDoc>) || mongoose.model<ProposalDoc>("Proposal", proposal);
export const DemoVideo: Model<VideoDoc> = (mongoose.models.DemoVideo as Model<VideoDoc>) || mongoose.model<VideoDoc>("DemoVideo", video);
