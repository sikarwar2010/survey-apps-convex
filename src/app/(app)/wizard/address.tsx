/**
 * Step 3 — Postal address. PIN auto-numeric, max 6 digits.
 */
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AppCard, AppInput, SectionLabel } from "@/components";
import { WizardStepFrame } from "@/hooks/WizardStepFrame";

export default function StepAddress() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  if (!localId) return null;

  return (
    <WizardStepFrame
      localId={localId}
      activeKey="address"
      title="Address"
      subtitle="Postal details for tax notices"
    >
      {({ draft, update }) => (
        <>
          <SectionLabel>Street address</SectionLabel>
          <AppCard padded className="mb-3">
            <View style={{ gap: 12 }}>
              <AppInput label="House no" required value={draft.houseNo ?? ""} onChangeText={(v) => update({ houseNo: v })} placeholder="e.g. 12/A" />
              <AppInput label="Street" required value={draft.street ?? ""} onChangeText={(v) => update({ street: v })} />
              <AppInput label="Locality" value={draft.locality ?? ""} onChangeText={(v) => update({ locality: v })} placeholder="Optional landmark area" />
            </View>
          </AppCard>

          <SectionLabel>City & PIN</SectionLabel>
          <AppCard padded>
            <View style={{ gap: 12 }}>
              <AppInput label="City / Town" required value={draft.city ?? ""} onChangeText={(v) => update({ city: v })} />
              <AppInput
                label="PIN code (6 digits)"
                required
                keyboardType="number-pad"
                maxLength={6}
                value={draft.pinCode ?? ""}
                onChangeText={(v) => update({ pinCode: v.replace(/\D/g, "").slice(0, 6) })}
                helperText="Cannot start with 0"
              />
            </View>
          </AppCard>
        </>
      )}
    </WizardStepFrame>
  );
}
