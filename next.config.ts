import type { NextConfig } from "next";

const r2Host = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const config: NextConfig = {
  poweredByHeader: false,
  // Uploads (slips, covers, report screenshots) travel inside Server Actions, whose default limit is 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "40mb" },
    optimizePackageImports: ["lucide-react"],
    turbopackFileSystemCacheForDev: true,
  },
  serverExternalPackages: ["mongoose", "bcryptjs", "nodemailer", "puppeteer-core", "@sparticuz/chromium"],
  // The PDF route needs the browser binary and the logos/font that are read from disk at run time.
  outputFileTracingIncludes: { "/api/pdf/[kind]/[id]": ["./node_modules/@sparticuz/chromium/bin/**", "./public/pdf/**"] },
  images: { remotePatterns: r2Host ? [{ protocol: "https", hostname: r2Host }] : [] },
};

export default config;
