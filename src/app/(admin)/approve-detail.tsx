/**
 * Approval detail — admin picks role + municipality + wards, then approves.
 *
 * `useMutation` returns the result of `admin.approveUser`. On success
 * we pop back; the row disappears from the approvals list reactively.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import {
  AppButton,
  AppCard,
  AppDropdown,
  Avatar,
  Banner,
  RadioGroup,
  SectionLabel,
  Spinner,
  Tag,
  Toast,
} from "@/components";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { applyFieldErrors, toUserMessage } from "@/utils/errors";

type Role = "surveyor" | "supervisor" | "admin";

export default function ApproveDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId as Id<"users"> | undefined;

  const masters = useQuery(api.masters.bundle, {});
  const pendingList = useQuery(api.admin.listPendingApprovals, {});
  const approve = useMutation(api.admin.approveUser);

  const user = pendingList?.find((u) => u._id === userId);

  const [role, setRole] = useState<Role>("surveyor");
  const [municipalityCode, setMunicipalityCode] = useState<string>("");
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; tone: "success" | "danger" } | null>(null);

  const muniOptions = useMemo(
    () =>
      masters?.ulbs.map((m) => ({ value: m.code, label: `${m.name} · ${m.districtName}` })) ?? [],
    [masters],
  );
  const selectedMuni = masters?.ulbs.find((m) => m.code === municipalityCode);
  const wardsForMuni = useMemo(
    () => (selectedMuni ? masters?.wards.filter((w) => w.municipalityCode === municipalityCode) ?? [] : []),
    [masters, municipalityCode, selectedMuni],
  );

  if (!userId) {
    return (
      <View className="flex-1 items-center justify-center bg-page-light dark:bg-page-dark">
        <Text className="text-helper text-ink-tertiary-light">No user selected</Text>
      </View>
    );
  }
  if (pendingList === undefined || masters === undefined) {
    return <Spinner label="Loading…" />;
  }
  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-page-light dark:bg-page-dark p-6">
        <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
        <Text className="text-h2 font-medium text-ink-primary-light dark:text-ink-primary-dark mt-3">
          Already processed
        </Text>
        <AppButton label="Back to approvals" onPress={() => router.back()} className="mt-6" />
      </View>
    );
  }

  const toggleWard = (wardNo: string) => {
    setSelectedWards((prev) =>
      prev.includes(wardNo) ? prev.filter((w) => w !== wardNo) : [...prev, wardNo],
    );
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await approve({
        userId,
        role,
        municipalityId: selectedMuni?._id,
        wardAssignments: selectedWards,
      });
      setToast({ title: `${user.name} approved`, tone: "success" });
      setTimeout(() => router.back(), 700);
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    role === "admin" ||
    (!!selectedMuni && (role === "supervisor" || selectedWards.length > 0));

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-brand">
        <View className="px-4 pt-2 pb-3 flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={6} className="w-9 h-9 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
          <Text className="text-h3 font-medium text-white ml-1">Review request</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <AppCard padded className="mb-4">
          <View className="flex-row items-center">
            <Avatar name={user.name} tone="brand" size="lg" />
            <View className="flex-1 ml-3">
              <Text className="text-h3 font-medium text-ink-primary-light dark:text-ink-primary-dark">
                {user.name}
              </Text>
              <Text className="text-helper text-ink-tertiary-light dark:text-ink-tertiary-dark">
                {user.email}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-1.5 mt-3">
            <Tag label={`Requested: ${user.requestedRole ?? "—"}`} tone="brand" icon="briefcase-outline" />
          </View>
          {user.requestedReason ? (
            <View className="mt-3 p-3 bg-page-light dark:bg-page-dark/40 rounded-lg">
              <Text className="text-caption text-ink-secondary-light dark:text-ink-secondary-dark italic">
                "{user.requestedReason}"
              </Text>
            </View>
          ) : null}
        </AppCard>

        <SectionLabel>Grant role</SectionLabel>
        <AppCard padded className="mb-4">
          <RadioGroup<Role>
            items={[
              { value: "surveyor", label: "Surveyor", helper: "Field surveyor — limited to assigned wards" },
              { value: "supervisor", label: "Supervisor", helper: "QC reviewer — ULB-wide access" },
              { value: "admin", label: "Admin", helper: "Platform admin — no tenant restriction" },
            ]}
            value={role}
            onChange={(r) => {
              setRole(r);
              if (r === "admin") {
                setMunicipalityCode("");
                setSelectedWards([]);
              }
            }}
          />
        </AppCard>

        {role !== "admin" ? (
          <>
            <SectionLabel>Municipality</SectionLabel>
            <View className="mb-4">
              <AppDropdown
                placeholder="Select a municipality"
                value={municipalityCode}
                options={muniOptions}
                onChange={(v) => {
                  setMunicipalityCode(v);
                  setSelectedWards([]);
                }}
              />
            </View>

            {role === "surveyor" && selectedMuni ? (
              <>
                <SectionLabel>Ward assignments</SectionLabel>
                <AppCard padded className="mb-4">
                  {wardsForMuni.length === 0 ? (
                    <Text className="text-caption text-ink-tertiary-light">
                      No wards configured for this municipality yet.
                    </Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-1.5">
                      {wardsForMuni.map((w) => {
                        const active = selectedWards.includes(w.wardNo);
                        return (
                          <Pressable
                            key={w._id}
                            onPress={() => toggleWard(w.wardNo)}
                            className={[
                              "px-3 py-1.5 rounded-full border",
                              active
                                ? "bg-brand border-brand"
                                : "bg-surface-light dark:bg-surface-dark border-line-default",
                            ].join(" ")}
                          >
                            <Text
                              className={[
                                "text-[12px] font-medium",
                                active ? "text-white" : "text-ink-primary-light dark:text-ink-primary-dark",
                              ].join(" ")}
                            >
                              Ward {w.wardNo} · {w.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <Text className="text-caption text-ink-tertiary-light mt-2">
                    {selectedWards.length} ward{selectedWards.length === 1 ? "" : "s"} selected
                  </Text>
                </AppCard>
              </>
            ) : null}
          </>
        ) : (
          <Banner
            tone="warning"
            title="Granting admin access"
            message="Admins can manage every user, municipality, and master data. Only grant this role when intended."
            icon="warning-outline"
          />
        )}

        <AppButton
          label={submitting ? "Approving…" : "Approve and grant access"}
          loading={submitting}
          onPress={handleApprove}
          disabled={!canSubmit}
          fullWidth
          className="mt-3"
        />
      </ScrollView>

      {toast ? (
        <Toast visible title={toast.title} tone={toast.tone} onHide={() => setToast(null)} />
      ) : null}
    </View>
  );
}
