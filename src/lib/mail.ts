import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

export async function sendMail(to: string, subject: string, text: string, html: string) {
  const smtp = env.smtp();
  if (!smtp.host || !smtp.user) throw new Error("Email is not set up. Add the SMTP settings to .env.local.");
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transport.sendMail({ from: smtp.from, to, subject, text, html });
}
