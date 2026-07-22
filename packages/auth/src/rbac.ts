import { Role } from "@svt/db";

/**
 * Brand-scoped role model. Every permission check happens against a specific
 * Brand — Gate 1 (content approval) and Gate 2 (publishing approval) are
 * granted to different roles on purpose, so one person approving the video
 * doesn't automatically get to approve what gets posted with it.
 */
export type Capability =
  | "brand:manage"
  | "clip:edit"
  | "clip:approve_content" // Gate 1
  | "post:approve_publishing" // Gate 2
  | "schedule:manage"
  | "brand:view";

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  ADMIN: [
    "brand:manage",
    "clip:edit",
    "clip:approve_content",
    "post:approve_publishing",
    "schedule:manage",
    "brand:view",
  ],
  EDITOR: ["clip:edit", "schedule:manage", "brand:view"],
  CONTENT_APPROVER: ["clip:approve_content", "brand:view"],
  PUBLISHING_APPROVER: ["post:approve_publishing", "schedule:manage", "brand:view"],
  VIEWER: ["brand:view"],
};

export interface MembershipLike {
  accountId: string;
  brandId: string | null;
  role: Role;
}

/**
 * A membership with brandId=null is an account-wide grant (e.g. an account
 * ADMIN) and applies to every brand under that account.
 */
export function can(
  memberships: MembershipLike[],
  capability: Capability,
  target: { accountId: string; brandId: string },
): boolean {
  return memberships.some((m) => {
    if (m.accountId !== target.accountId) return false;
    if (m.brandId !== null && m.brandId !== target.brandId) return false;
    return ROLE_CAPABILITIES[m.role].includes(capability);
  });
}
