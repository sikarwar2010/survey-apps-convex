/**
 * Owner mobile rules shared with the mobile app (`@/convex/ownerMobile`).
 *
 * - Respondent is the owner (`relationship === 'self'`): valid Indian mobile required.
 * - Respondent is not the owner: `0000000000` is accepted when owner contact is unknown.
 */

export const OWNER_MOBILE_UNKNOWN = '0000000000';

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

export function isRespondentOwner(relationship?: string): boolean {
  return relationship?.trim() === 'self';
}

export function isValidIndianOwnerMobile(value: string): boolean {
  return INDIAN_MOBILE_RE.test(value.trim());
}

/** Whether an owner-row mobile is acceptable for the given respondent relationship. */
export function isAcceptedOwnerMobile(mobile: string, relationship?: string): boolean {
  const v = mobile.trim();
  if (isValidIndianOwnerMobile(v)) return true;
  if (!isRespondentOwner(relationship) && v === OWNER_MOBILE_UNKNOWN) return true;
  return false;
}

/** Primary contact from owner rows (valid mobile or unknown placeholder when not self). */
export function primaryOwnerMobileFromOwners(
  owners: { mobileNo?: string }[] | undefined,
  relationship?: string,
): string | undefined {
  if (!owners?.length) return undefined;
  for (const o of owners) {
    const m = o.mobileNo?.trim();
    if (m && isAcceptedOwnerMobile(m, relationship)) return m;
  }
  return undefined;
}
