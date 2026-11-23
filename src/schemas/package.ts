import { z } from "zod";
import { CATEGORIES, DURATIONS } from "@/models/package";
import { ICON_IDS } from "@/lib/package-icons";

export const packageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the package name.").max(120),
  category: z.enum(CATEGORIES, { message: "Choose a category." }),
  description: z.string().trim().max(20000, "Description must be 20,000 characters or fewer.").default(""),
  price: z.coerce.number({ message: "Enter a price." }).positive("The price must be more than zero."),
  duration: z.enum(DURATIONS, { message: "Choose a duration." }),
  included: z.string().trim().max(20000, "Included items must be 20,000 characters or fewer.").default(""),
  summary: z.string().trim().max(20000, "Quote summary must be 20,000 characters or fewer.").default(""),
  icon: z.union([z.literal(""), z.string().refine((id) => ICON_IDS.includes(id), "Choose an icon from the list.")]).default(""),
  status: z.enum(["active", "archived"]).default("active"),
});
