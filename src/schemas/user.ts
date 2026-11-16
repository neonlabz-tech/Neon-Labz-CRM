import { z } from "zod";
import { ROLES } from "@/lib/permissions";
import { MIN_PASSWORD } from "./auth";

const sriLankanPhone = /^(07[01245678]\d{7}|0(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)\d{7})$/;

export const createUserSchema = z.object({
  role: z.enum(ROLES).exclude(["superadmin"]),
  fullName: z.string().trim().min(2, "Enter a name.").max(120),
  password: z.string().trim().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(100),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .transform((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.startsWith("94") && digits.length > 10 ? `0${digits.slice(2)}` : digits;
    })
    .refine((v) => v === "" || sriLankanPhone.test(v), "Enter a Sri Lankan number such as 077 123 4567, or leave it blank."),
  address: z.string().trim().max(300, "Keep the address under 300 characters."),
});
