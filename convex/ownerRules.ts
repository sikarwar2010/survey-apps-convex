/**
 * Owner-step business rules — respondent relationships and owner list limits.
 * Canonical dropdown values live here (not admin-editable masters).
 */
import { query } from './_generated/server';

export const RESPONDENT_RELATIONSHIP_VALUES = [
  'self',
  'father',
  'mother',
  'wife',
  'son',
  'daughter',
  'brother',
  'sister',
  'neighbour',
  'other',
] as const;

export type RespondentRelationshipValue = (typeof RESPONDENT_RELATIONSHIP_VALUES)[number];

export const RESPONDENT_RELATIONSHIPS: { value: RespondentRelationshipValue; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'wife', label: 'Wife' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'neighbour', label: 'Neighbour' },
  { value: 'other', label: 'Other' },
];

const RELATIONSHIP_SET = new Set<string>(RESPONDENT_RELATIONSHIP_VALUES);

export const MAX_SURVEY_OWNERS = 10;

export type OwnerEntry = {
  name?: string;
  fatherOrHusbandName?: string;
};

export function isValidRespondentRelationship(value: string): boolean {
  return RELATIONSHIP_SET.has(value);
}

/** Drop blank rows; trim names. */
export function normalizeOwners(owners: OwnerEntry[] | undefined): OwnerEntry[] | undefined {
  if (!owners?.length) return undefined;
  const cleaned = owners
    .map((o) => ({
      name: o.name?.trim() || undefined,
      fatherOrHusbandName: o.fatherOrHusbandName?.trim() || undefined,
    }))
    .filter((o) => o.name || o.fatherOrHusbandName);
  return cleaned.length ? cleaned : undefined;
}

/** Field-level validation for owner section (merged into survey upsert). */
export function validateOwnerSection(input: {
  relationship?: string;
  owners?: OwnerEntry[];
}): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  if (input.relationship && !isValidRespondentRelationship(input.relationship)) {
    details.relationship = ['Select a valid relationship to owner'];
  }
  const count = input.owners?.length ?? 0;
  if (count > MAX_SURVEY_OWNERS) {
    details.owners = [`At most ${MAX_SURVEY_OWNERS} owners allowed`];
  }
  return details;
}

/** Mobile dropdown source — single source of truth for respondent relationship. */
export const respondentRelationships = query({
  args: {},
  handler: async () => ({
    options: RESPONDENT_RELATIONSHIPS,
    maxOwners: MAX_SURVEY_OWNERS,
  }),
});
