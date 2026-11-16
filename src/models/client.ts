import mongoose, { type InferSchemaType, type Model } from "mongoose";

/** A paying client: created when the Super Admin approves the first payment. */
const person = new mongoose.Schema({ name: String, title: String, email: String, phone: String }, { _id: false });

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    service: { type: String, default: "" },
    workType: { type: String, enum: ["software", "marketing", "both"], default: "software" },
    logo: { type: String, default: "" },
    contactName: { type: String, default: "" },
    contactTitle: { type: String, default: "" },
    assignedPerson: { type: String, default: "" },
    notes: { type: String, default: "" },
    subContacts: { type: [person], default: [] },
    leadId: { type: String, required: true },
    salesOwner: { type: String, required: true },
    approvedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
schema.index({ name: 1 });
schema.index({ createdAt: -1 });

export type ClientDoc = InferSchemaType<typeof schema>;
export const Client: Model<ClientDoc> = (mongoose.models.Client as Model<ClientDoc>) || mongoose.model<ClientDoc>("Client", schema);
