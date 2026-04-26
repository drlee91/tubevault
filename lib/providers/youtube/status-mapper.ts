import type { AvailabilityStatus } from "../types";

export function mapYouTubeAvailability(
  raw: string | null,
  fallbackTitle?: string,
): AvailabilityStatus {
  switch (raw) {
    case "public":
    case "unlisted":
      return "available";
    case "private":
      return "private";
    case "needs_auth":
    case "subscriber_only":
    case "premium_only":
      return "auth_required";
  }
  switch (fallbackTitle) {
    case "[Deleted video]":
      return "removed";
    case "[Private video]":
      return "private";
    case "[Unavailable]":
      return "unknown";
  }
  return "unknown";
}
