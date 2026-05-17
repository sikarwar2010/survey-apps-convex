/**
 * Step 5 — Floors.
 *
 * 1:N collection; each floor has a stable client-generated id so the
 * server can reconcile reorders/edits on submit. Editor opens inline
 * (no second screen) — minimum taps from the field.
 */
import {
  AppButton, AppCard, AppDropdown, AppInput, ChipSelector, EmptyState,
  SectionLabel, Spinner, Tag,
} from "@/components";
import { api } from "@/convex/_generated/api";
import type { WizardDraft } from "@/hooks/useWizardDraft";
import { WizardStepFrame } from "@/hooks/WizardStepFrame";
import { formatArea, humanizeRole } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

type Floor = NonNullable<WizardDraft["floors"]>[number];

function newFloorId() {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function StepFloors() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const masters = useQuery(api.masters.bundle, {});
  const [editing, setEditing] = useState<Floor | null>(null);

  if (!masters || !localId) return <Spinner label="Loading…" />;

  return (
    <WizardStepFrame
      localId={localId}
      activeKey="floors"
      title="Floors"
      subtitle="At least one floor required"
    >
      {({ draft, update }) => {
        const floors = draft.floors ?? [];

        const saveFloor = async (f: Floor) => {
          const existing = floors.findIndex((x) => x.clientFloorId === f.clientFloorId);
          const next = [...floors];
          if (existing >= 0) next[existing] = f;
          else next.push(f);
          await update({ floors: next });
          setEditing(null);
        };

        const removeFloor = (id: string) => {
          Alert.alert("Remove this floor?", undefined, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: async () => {
                await update({ floors: floors.filter((f) => f.clientFloorId !== id) });
              },
            },
          ]);
        };

        return (
          <>
            <SectionLabel>Floor list</SectionLabel>
            <View style={{ gap: 8 }} className="mb-3">
              {floors.length === 0 ? (
                <EmptyState
                  icon="layers-outline"
                  title="No floors yet"
                  message="Add at least one floor (ground, first, terrace, etc.)"
                />
              ) : (
                floors.map((f, i) => (
                  <AppCard key={f.clientFloorId} padded>
                    <View className="flex-row items-start">
                      <View className="w-9 h-9 rounded-full bg-brand-soft items-center justify-center">
                        <Text className="text-[12px] font-medium text-brand">{i + 1}</Text>
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-[13px] font-medium text-ink-primary-light dark:text-ink-primary-dark">
                          {humanizeRole(f.floorName)}
                        </Text>
                        <Text className="text-caption text-ink-tertiary-light mt-0.5">
                          {humanizeRole(f.usageType)} · {humanizeRole(f.constructionType)} · {formatArea(f.areaSqft)}
                        </Text>
                        <View className="flex-row gap-1.5 mt-2">
                          {f.isOccupied ? <Tag label="Occupied" tone="success" /> : <Tag label="Vacant" tone="neutral" />}
                        </View>
                      </View>
                      <View className="flex-row gap-1">
                        <Pressable onPress={() => setEditing(f)} className="w-9 h-9 items-center justify-center">
                          <Ionicons name="create-outline" size={18} color="#003B8E" />
                        </Pressable>
                        <Pressable onPress={() => removeFloor(f.clientFloorId)} className="w-9 h-9 items-center justify-center">
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  </AppCard>
                ))
              )}
            </View>

            {editing ? (
              <FloorEditor
                masters={masters}
                value={editing}
                onSave={saveFloor}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <AppButton
                label="Add a floor"
                variant="outline"
                iconLeft="add-circle-outline"
                onPress={() =>
                  setEditing({
                    clientFloorId: newFloorId(),
                    floorName: masters.floors[0]?.value ?? "ground",
                    usageType: masters.usageTypes[0]?.value ?? "residential",
                    constructionType: masters.constructionTypes[0]?.value ?? "rcc",
                    isOccupied: true,
                    areaSqft: 0,
                  })
                }
                fullWidth
              />
            )}
          </>
        );
      }}
    </WizardStepFrame>
  );
}

/* ────────────────────────── Floor editor ────────────────────────── */

interface FloorEditorProps {
  masters: NonNullable<ReturnType<typeof useQuery<typeof api.masters.bundle>>>;
  value: Floor;
  onSave: (f: Floor) => void;
  onCancel: () => void;
}
function FloorEditor({ masters, value, onSave, onCancel }: FloorEditorProps) {
  const [f, setF] = useState<Floor>(value);
  const canSave = f.areaSqft > 0;

  return (
    <AppCard padded className="border-2 border-brand">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-h3 font-medium text-ink-primary-light dark:text-ink-primary-dark">
          {value.areaSqft > 0 ? "Edit floor" : "New floor"}
        </Text>
        <Pressable onPress={onCancel} hitSlop={6}>
          <Ionicons name="close" size={20} color="#6B7280" />
        </Pressable>
      </View>
      <View style={{ gap: 12 }}>
        <View>
          <Text className="text-label uppercase tracking-wider font-medium text-ink-secondary-light mb-1.5">Floor name</Text>
          <ChipSelector value={f.floorName} options={masters.floors} onChange={(v: string) => setF({ ...f, floorName: v })} />
        </View>
        <AppDropdown placeholder="Usage" value={f.usageType} options={masters.usageTypes} onChange={(v) => setF({ ...f, usageType: v })} />
        <AppDropdown placeholder="Construction" value={f.constructionType} options={masters.constructionTypes} onChange={(v) => setF({ ...f, constructionType: v })} />
        <AppInput
          label="Area (sq ft)"
          required
          keyboardType="decimal-pad"
          value={f.areaSqft > 0 ? String(f.areaSqft) : ""}
          onChangeText={(v) => setF({ ...f, areaSqft: parseFloat(v) || 0 })}
        />
        <ChipSelector
          value={f.isOccupied ? "yes" : "no"}
          options={[{ value: "yes", label: "Occupied" }, { value: "no", label: "Vacant" }]}
          onChange={(v: string) => setF({ ...f, isOccupied: v === "yes" })}
          scroll={false}
        />
      </View>
      <View className="flex-row gap-2 mt-3">
        <AppButton label="Cancel" variant="outline" onPress={onCancel} className="flex-1" />
        <AppButton label="Save floor" onPress={() => onSave(f)} disabled={!canSave} className="flex-1" />
      </View>
    </AppCard>
  );
}
