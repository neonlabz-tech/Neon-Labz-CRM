import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { RECURRENCES } from "@/lib/meetings";

const schema = new mongoose.Schema(
  {
    projectCode: { type: String, required: true, index: true },
    startDate: { type: String, required: true },
    time: { type: String, required: true },
    link: { type: String, required: true, trim: true },
    recurrence: { type: String, enum: Object.keys(RECURRENCES), default: "none" },
    /** Status of each date of the series, keyed YYYY-MM-DD. A date with no entry is still scheduled. */
    statusByDate: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: String, required: true },
    /** Set by the Super Admin: which team the meeting goes to. Blank means it follows the project, as before. */
    audience: { type: String, enum: ["", "pm", "marketing", "both"], default: "" },
  },
  { timestamps: true, minimize: false }
);

export type MeetingDoc = InferSchemaType<typeof schema>;
export const Meeting: Model<MeetingDoc> = (mongoose.models.Meeting as Model<MeetingDoc>) || mongoose.model<MeetingDoc>("Meeting", schema);
