import mongoose, { type Model } from "mongoose";

type CounterDoc = { _id: string; seq: number };
const schema = new mongoose.Schema<CounterDoc>({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });

export const Counter: Model<CounterDoc> = (mongoose.models.Counter as Model<CounterDoc>) || mongoose.model<CounterDoc>("Counter", schema);
