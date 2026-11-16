export const PHONE_ERROR = "Enter a Sri Lankan phone number, such as 077-123-4567 or 011-234-5678.";
export const PHONE_TAKEN = "This phone number already exists in the system.";
export const EMAIL_ERROR = "Enter an email address with an @ and a domain, such as name@company.com.";

export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length > 10) digits = `0${digits.slice(2)}`;
  return digits.slice(0, 10);
}

export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function validSriLankanPhone(value: string): boolean {
  const d = phoneDigits(value);
  if (!/^0\d{9}$/.test(d)) return false;
  if (/^07[01245678]\d{7}$/.test(d)) return true;
  return /^0(?:11|21|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)\d{7}$/.test(d);
}

export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
