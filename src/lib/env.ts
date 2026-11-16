function read(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function required(name: string): string {
  const value = read(name);
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
  return value;
}

export const env = {
  mongoUri: () => required("MONGODB_URI"),
  jwtSecret: () => required("JWT_SECRET"),
  appUrl: () => read("APP_URL") || "http://localhost:3000",
  superadminEmail: () => read("SUPERADMIN_EMAIL").toLowerCase(),
  seedPassword: () => read("SEED_SUPERADMIN_PASSWORD") || "NeonLabz@2026",
  smtp: () => ({
    host: read("SMTP_HOST"),
    port: Number(read("SMTP_PORT")) || 587,
    user: read("SMTP_USER"),
    pass: read("SMTP_PASS"),
    from: read("SMTP_FROM") || read("SMTP_USER"),
  }),
};
