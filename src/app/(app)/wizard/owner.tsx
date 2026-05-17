/**
 * Step 2 — Owner & respondent.
 *
 * Respondent might differ from owner. Multiple co-owners supported.
 * Relationship options and limits are defined in Convex (`ownerRules`).
 */
import { AppButton, AppCard, AppDropdown, AppInput, NumberStepper, SectionLabel, Spinner } from '@/components';
import { api } from '@/convex/_generated/api';
import { WizardStepFrame } from '@/hooks/WizardStepFrame';
import { newOwnerRow, stepCompletion, type WizardDraft, type WizardOwnerRow } from '@/hooks/useWizardDraft';
import { isValidIndianMobile, sanitizeMobileDigits } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

const MOBILE_HELPER = '10 digits, starting with 6, 7, 8 or 9';

function ensureOwnerRows(owners: WizardOwnerRow[] | undefined): WizardOwnerRow[] {
  return owners?.length ? owners : [newOwnerRow()];
}

function mobileFieldError(draft: WizardDraft, field: 'mobileNo' | 'altMobileNo'): string | undefined {
  const value = field === 'mobileNo' ? draft.mobileNo : draft.altMobileNo;
  if (!value) return field === 'mobileNo' ? 'Mobile number is required' : undefined;
  if (value.length < 10) return 'Enter all 10 digits';
  if (!isValidIndianMobile(value)) return MOBILE_HELPER;
  if (field === 'altMobileNo' && draft.mobileNo && isValidIndianMobile(draft.mobileNo) && value === draft.mobileNo) {
    return 'Must differ from primary mobile';
  }
  return undefined;
}

export default function StepOwner() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const ownerRules = useQuery(api.ownerRules.respondentRelationships, {});

  if (!ownerRules || !localId) return <Spinner label="Loading…" />;

  return (
    <WizardStepFrame
      localId={localId}
      activeKey="owner"
      title="Owner details"
      subtitle="Who lives or owns this property?"
      nextDisabled={(d) => !stepCompletion(d).owner}
    >
      {({ draft, update }) => {
        const mobileError = mobileFieldError(draft, 'mobileNo');
        const altError = mobileFieldError(draft, 'altMobileNo');
        const ownerRows = ensureOwnerRows(draft.owners);
        const maxOwners = ownerRules.maxOwners;

        const patchOwners = (next: WizardOwnerRow[]) => update({ owners: next });

        const updateOwner = (id: string, patch: Partial<WizardOwnerRow>) => {
          patchOwners(ownerRows.map((o) => (o.clientOwnerId === id ? { ...o, ...patch } : o)));
        };

        const addOwner = () => {
          if (ownerRows.length >= maxOwners) return;
          patchOwners([...ownerRows, newOwnerRow()]);
        };

        const removeOwner = (id: string) => {
          if (ownerRows.length <= 1) {
            patchOwners([newOwnerRow()]);
            return;
          }
          Alert.alert('Remove this owner?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => patchOwners(ownerRows.filter((o) => o.clientOwnerId !== id)),
            },
          ]);
        };

        return (
          <>
            <SectionLabel>Respondent</SectionLabel>
            <AppCard padded className="mb-3">
              <View style={{ gap: 12 }}>
                <AppInput
                  label="Name of respondent"
                  value={draft.respondentName ?? ''}
                  onChangeText={(v) => update({ respondentName: v })}
                  placeholder="Person met at the door"
                />
                <AppDropdown
                  placeholder="Respondent relationship with owner"
                  value={draft.relationship ?? ''}
                  options={ownerRules.options}
                  onChange={(v) => update({ relationship: v })}
                />
              </View>
            </AppCard>

            <SectionLabel>Owners</SectionLabel>
            <View style={{ gap: 8 }} className="mb-3">
              {ownerRows.map((row, index) => (
                <AppCard key={row.clientOwnerId} padded>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-label uppercase tracking-wider font-medium text-ink-secondary-light dark:text-ink-secondary-dark">
                      Owner {index + 1}
                    </Text>
                    {ownerRows.length > 1 ? (
                      <Pressable onPress={() => removeOwner(row.clientOwnerId)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ gap: 12 }}>
                    <AppInput
                      label="Owner name"
                      value={row.name ?? ''}
                      onChangeText={(v) => updateOwner(row.clientOwnerId, { name: v })}
                      placeholder="As per municipal records"
                    />
                    <AppInput
                      label="Father name / husband name"
                      value={row.fatherOrHusbandName ?? ''}
                      onChangeText={(v) => updateOwner(row.clientOwnerId, { fatherOrHusbandName: v })}
                    />
                  </View>
                </AppCard>
              ))}
            </View>
            {ownerRows.length < maxOwners ? (
              <AppButton
                label="Add another owner"
                variant="outline"
                iconLeft="add-circle-outline"
                onPress={addOwner}
                fullWidth
                className="mb-3"
              />
            ) : null}

            <SectionLabel>Household & contact</SectionLabel>
            <AppCard padded>
              <View style={{ gap: 12 }}>
                <NumberStepper
                  label="Number of family members (optional)"
                  value={draft.familySize ?? 0}
                  min={0}
                  max={99}
                  onChange={(v) => update({ familySize: v > 0 ? v : undefined })}
                />
                {draft.familySize == null || draft.familySize === 0 ? (
                  <Text className="text-caption text-ink-tertiary-light dark:text-ink-tertiary-dark -mt-2">
                    Use + to set family size, or leave at 0 if unknown
                  </Text>
                ) : null}
                <AppInput
                  label="Mobile number"
                  required
                  keyboardType="number-pad"
                  maxLength={10}
                  value={draft.mobileNo ?? ''}
                  onChangeText={(v) => update({ mobileNo: sanitizeMobileDigits(v) })}
                  helperText={mobileError ?? MOBILE_HELPER}
                />
                <AppInput
                  label="Alternative mobile number"
                  keyboardType="number-pad"
                  maxLength={10}
                  value={draft.altMobileNo ?? ''}
                  onChangeText={(v) => update({ altMobileNo: sanitizeMobileDigits(v) })}
                  helperText={altError ?? MOBILE_HELPER}
                  placeholder="Optional"
                />
              </View>
            </AppCard>
          </>
        );
      }}
    </WizardStepFrame>
  );
}
