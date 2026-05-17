/**
 * Step 1 — Property identification.
 *
 * Locks municipality + ward early because every other section makes sense
 * only within a single property location. If the surveyor has just one
 * municipality assigned, the picker auto-selects it.
 */
import { AppCard, AppDropdown, AppInput, ChipSelector, SectionLabel, Spinner } from '@/components';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { WizardDraft } from '@/hooks/useWizardDraft';
import { WizardStepFrame } from '@/hooks/WizardStepFrame';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

export default function StepProperty() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const masters = useQuery(api.masters.bundle, {});
  const me = useQuery(api.users.currentUser, {});

  if (!masters || !me || !localId) return <Spinner label="Loading masters…" />;

  return (
    <WizardStepFrame
      localId={localId}
      activeKey="property"
      title="Property identification"
      subtitle="Where is this property?"
    >
      {({ draft, update }) => <PropertyFields draft={draft} update={update} masters={masters} me={me} />}
    </WizardStepFrame>
  );
}

function PropertyFields({
  draft,
  update,
  masters,
  me,
}: {
  draft: WizardDraft;
  update: (patch: Partial<WizardDraft>) => Promise<void>;
  masters: NonNullable<ReturnType<typeof useQuery<typeof api.masters.bundle>>>;
  me: NonNullable<ReturnType<typeof useQuery<typeof api.users.currentUser>>>;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || draft.municipalityId || !me.municipalityId) return;
    initialized.current = true;
    void update({ municipalityId: me.municipalityId });
  }, [draft.municipalityId, me.municipalityId, update]);

  const muniOptions = masters.ulbs.map((u) => ({ value: u._id, label: u.name }));
  const muniValue = (draft.municipalityId ?? me.municipalityId ?? '') as string;
  const muniCode = masters.ulbs.find((u) => u._id === muniValue)?.code;
  const wardOptions = masters.wards
    .filter((w) => w.municipalityCode === muniCode)
    .map((w) => ({ value: w.wardNo, label: `Ward ${w.wardNo} · ${w.name}` }));

  return (
    <>
      <SectionLabel>Location</SectionLabel>
      <AppCard padded className="mb-3">
        <View style={{ gap: 12 }}>
          <AppDropdown
            placeholder="Municipality"
            value={muniValue}
            options={muniOptions}
            onChange={(v) => update({ municipalityId: v as Id<'municipalities'>, wardNo: undefined })}
            disabled={muniOptions.length === 1}
          />
          <AppDropdown
            placeholder="Ward"
            value={draft.wardNo ?? ''}
            options={wardOptions}
            onChange={(v) => update({ wardNo: v })}
            disabled={!muniValue}
          />
        </View>
      </AppCard>

      <SectionLabel>Identification</SectionLabel>
      <AppCard padded className="mb-3">
        <AppInput
          label="Property number"
          required
          value={draft.propertyNo ?? ''}
          onChangeText={(v) => update({ propertyNo: v })}
          placeholder="e.g. 12/45/A"
          helperText="Use the official municipal property number from the assessment register"
        />
      </AppCard>

      <SectionLabel>Slum classification</SectionLabel>
      <AppCard padded>
        <ChipSelector
          value={draft.isSlum ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'Not in slum area' },
            { value: 'yes', label: 'Slum area' },
          ]}
          onChange={(v) => update({ isSlum: v === 'yes' })}
          scroll={false}
        />
      </AppCard>
    </>
  );
}
