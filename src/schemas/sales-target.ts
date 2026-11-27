import { z } from "zod";

const count = (message: string) => z.coerce.number({ error: message }).int(message).min(0, message).max(100000, message);

export const staffTargetSchema = z.object({
  username: z.string().trim().toUpperCase().min(1),
  name: z.string().trim().min(1, "Enter a display name.").max(80),
  target: z.coerce.number({ error: "Monthly target must be zero or more." }).min(0, "Monthly target must be zero or more.").max(1_000_000_000),
  rate: z.coerce.number({ error: "Commission rate must be between 0 and 100." }).min(0, "Commission rate must be between 0 and 100.").max(100, "Commission rate must be between 0 and 100."),
  dailyLeads: count("Daily lead and call targets must be whole numbers, zero or more."),
  dailyCalls: count("Daily lead and call targets must be whole numbers, zero or more."),
});

export const salesSettingsSchema = z.object({
  monthlyTarget: z.coerce.number({ error: "Enter zero or more for each setting." }).min(0, "Enter zero or more for each setting.").max(1_000_000_000),
  monthlyConversions: count("Monthly conversions target must be a whole number, zero or more."),
  dailyLeads: count("Daily lead and call targets must be whole numbers."),
  dailyCalls: count("Daily lead and call targets must be whole numbers."),
  defaultRate: z.coerce.number({ error: "Enter zero or more for each setting." }).min(0, "Enter zero or more for each setting.").max(100, "Commission rate must be between 0 and 100."),
});
