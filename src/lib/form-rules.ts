import { EMAIL_ERROR, PHONE_ERROR, formatPhone, validEmail, validSriLankanPhone } from "./phone";

export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export const isControl = (el: unknown): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/** Every named, enabled control in the form that the person can fill in. */
export function controlsOf(form: HTMLFormElement): Control[] {
  return Array.from(form.elements).filter((el): el is Control => isControl(el) && Boolean(el.name) && !el.disabled && el.type !== "hidden" && el.type !== "submit" && el.type !== "button");
}

export function labelOf(el: Control): string {
  const form = el.form;
  const own = el.id && form ? form.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  const text = (own ?? el.closest("label"))?.textContent ?? el.getAttribute("aria-label") ?? el.name;
  return text.replace(/\*/g, "").trim() || el.name;
}

export const isPhoneField = (el: Control) => /phone/i.test(el.name) && !/digits/i.test(el.name) && el instanceof HTMLInputElement && el.type !== "checkbox";

/** Live formatting while typing a phone number: 077-123-4567. */
export const formatPhoneField = (el: Control) => {
  const next = formatPhone(el.value);
  if (next !== el.value) el.value = next;
};

/** A date field that may not be earlier than another date field in the same form. */
const NOT_BEFORE: Record<string, string> = { dueDate: "startDate", endDate: "startDate", to: "from" };
const MUST_BE_POSITIVE = /^(amount|price)$/;
export const MIN_PASSWORD = 8;

/** The message to show under one control, or "" when its value is fine. */
export function validateControl(el: Control, form: HTMLFormElement): string {
  const label = labelOf(el);
  const raw = el.value;
  const value = raw.trim();

  // A field can carry a message from a live server check (for example a phone number that is already taken).
  if (value && el instanceof HTMLInputElement && el.dataset.taken) return el.dataset.taken;

  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.required && !el.checked ? `${label} is required.` : "";
  if (el instanceof HTMLInputElement && el.type === "radio") return "";
  if (!value) {
    if (el.required) return `${label} is required.`;
    // An optional password pair still has to agree when only one half is filled in.
    if (el.name === "confirm" && el.type === "password") {
      const first = form.elements.namedItem("next") ?? form.elements.namedItem("password");
      if (isControl(first) && first.value) return "Passwords do not match.";
    }
    return "";
  }

  if (el instanceof HTMLInputElement) {
    if (el.type === "email" || /email/i.test(el.name)) return validEmail(value) ? "" : EMAIL_ERROR;
    if (isPhoneField(el)) return validSriLankanPhone(value) ? "" : PHONE_ERROR;
    if (el.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Enter a number.";
      if (MUST_BE_POSITIVE.test(el.name) && n <= 0) return `${label} must be greater than 0.`;
      if (el.min !== "" && n < Number(el.min)) return `${label} must be ${el.min} or more.`;
      if (el.max !== "" && n > Number(el.max)) return `${label} must be ${el.max} or less.`;
      if (n < 0) return `${label} can't be negative.`;
    }
    if (el.type === "date") {
      if (el.min && value < el.min) return `${label} can't be before ${el.min}.`;
      const other = form.elements.namedItem(NOT_BEFORE[el.name] ?? "");
      if (isControl(other) && other.value && value < other.value) return `${label} can't be before ${labelOf(other).toLowerCase()}.`;
    }
    if (el.type === "password") {
      if (el.name === "confirm") {
        const first = form.elements.namedItem("next") ?? form.elements.namedItem("password");
        if (isControl(first) && first.value !== raw) return "Passwords do not match.";
      } else if (el.autocomplete === "new-password" && raw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
    }
    if (el.pattern && el.validity.patternMismatch) return el.title || `Check ${label.toLowerCase()}.`;
  }
  if (!(el instanceof HTMLSelectElement) && el.minLength > 0 && value.length < el.minLength) return `${label} needs at least ${el.minLength} characters.`;
  return "";
}
