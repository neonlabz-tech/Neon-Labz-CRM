"use client";

import { useEffect } from "react";
import { markProjectNoticesReadAction } from "@/server/notice-actions";

/** Opening a project marks that project's unread notifications as read, so the count on its My work card goes away. */
export function ProjectSeen({ code }: { code: string }) {
  useEffect(() => { void markProjectNoticesReadAction(code); }, [code]);
  return null;
}
