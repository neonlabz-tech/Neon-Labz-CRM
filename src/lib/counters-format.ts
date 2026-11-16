export const leadId = (n: number) => `LEAD-${String(n).padStart(4, "0")}`;
export const clientCode = (n: number) => `CLI${String(n).padStart(3, "0")}`;
export const saleCode = (n: number) => `SID-${String(n).padStart(4, "0")}`;
export const quoteNumber = (year: string, n: number) => `NL-Q-${year}-${String(n).padStart(4, "0")}`;
export const projectCode = (n: number) => `NPRJ${String(n).padStart(3, "0")}`;
export const taskCode = (n: number) => `TSK${String(n).padStart(3, "0")}`;
export const issueCode = (n: number) => `ISS${String(n).padStart(3, "0")}`;
export const manualSaleCode = (n: number) => `SL-${String(n).padStart(3, "0")}`;
