/**
 * Approval detail — admin picks role + municipality + wards, then approves.
 */
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
import { AdminHeader } from "@/components/admin/admin-header";
import { WorkflowSteps } from "@/components/admin/workflow-steps";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUserMessage } from "@/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Role = "surveyor" | "supervisor" | "admin";

export default function ApproveDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId as Id<"users"> | undefined;

  const masters = useQuery(api.masters.bundle, {});
  const pendingList = useQuery(api.admin.listPendingApprovals, {});
  const approve = useMutation(api.admin.approveUser);
  const rejectUser = useMutation(api.admin.rejectUser);

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
    () =>
      selectedMuni
        ? (masters?.wards.filter((w) => w.municipalityCode === municipalityCode) ?? [])
        : [],
    [masters, municipalityCode, selectedMuni],
  );

  const scopeReady =
    role === "admin" ||
    (!!selectedMuni && (role === "supervisor" || selectedWards.length > 0));

  const workflowStep = scopeReady ? 2 : 1;

  if (!userId) {
    return (
      <View className="flex-1 items-center justify-center bg-page-light dark:bg-page-dark p-6">
        <EmptyFallback
          icon="alert-circle-outline"
          title="No user selected"
          message="Go back to approvals and pick a request."
          onBack={() => router.back()}
        />
      </View>
    );
  }
  if (pendingList === undefined || masters === undefined) {
    return <Spinner label="Loading request…" />;
  }
  if (!user) {
    return (
      <View className="flex-1 bg-page-light dark:bg-page-dark">
        <AdminHeader title="Request handled" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center p-6">
          <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
          <Text className="text-h2 font-medium text-ink-primary-light dark:text-ink-primary-dark mt-3 text-center">
            Already processed
          </Text>
          <Text className="text-helper text-ink-tertiary-light text-center mt-1">
            This sign-up was approved or rejected. Check Users for their status.
          </Text>
          <AppButton
            label="Back to approvals"
            onPress={() => router.replace("/(admin)/approvals")}
            className="mt-6"
          />
        </View>
      </View>
    );
  }

  const toggleWard = (wardNo: string) => {
    setSelectedWards((prev) =>
      prev.includes(wardNo) ? prev.filter((w) => w !== wardNo) : [...prev, wardNo],
    );
  };

  const onReject = () => {
    Alert.alert(
      "Reject this request?",
      `${user.name} will not receive access.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              await rejectUser({ userId });
              setToast({ title: "Request rejected", tone: "success" });
              setTimeout(() => router.back(), 600);
            } catch (e) {
              setToast({ title: toUserMessage(e), tone: "danger" });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
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

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <AdminHeader
        title="Review request"
        subtitle={user.name}
        onBack={() => router.back()}
        right={
          <Pressable onPress={onReject} hitSlop={8} className="px-2 py-1">
            <Text className="text-caption font-medium text-white/90">Reject</Text>
          </Pressable>
        }
        footer={
          <View className="mt-3 bg-white/10 rounded-xl px-2 py-2">
            <WorkflowSteps
              steps={[
                { label: "Review", done: true },
                { label: "Assign", active: workflowStep === 1, done: workflowStep === 2 },
                { label: "Approve", active: workflowStep === 2, done: false },
              ]}
            />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
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
              <Text className="text-caption text-ink-secondary-light dark:text-ink-secondary-dark">
                {user.requestedReason}
              </Text>
            </View>
          ) : null}
        </AppCard>

        <SectionLabel>1 · Grant role</SectionLabel>
        <AppCard padded className="mb-4">
          <RadioGroup<Role>
            items={[
              { value: "surveyor", label: "Surveyor", helper: "Field work — assigned wards only" },
              { value: "supervisor", label: "Supervisor", helper: "QC — full municipality access" },
              { value: "admin", label: "Admin", helper: "Platform-wide administration" },
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
            <SectionLabel>2 · Municipality scope</SectionLabel>
            <View className="mb-4">
              <AppDropdown
                placeholder="Select municipality (ULB)"
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
                <SectionLabel>3 · Ward assignments</SectionLabel>
                <AppCard padded className="mb-4">
                  {wardsForMuni.length === 0 ? (
                    <View>
                      <Banner
                        tone="warning"
                        title="No wards configured"
                        message="Add wards under Masters before assigning this surveyor."
                        icon="map-outline"
                      />
                      <AppButton
                        label="Open Masters"
                        variant="outline"
                        size="sm"
                        onPress={() => router.push("/(admin)/masters")}
                        className="mt-3"
                      />
                    </View>
                  ) : (
                    <>
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
                                  active
                                    ? "text-white"
                                    : "text-ink-primary-light dark:text-ink-primary-dark",
                                ].join(" ")}
                              >
                                Ward {w.wardNo} · {w.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text className="text-caption text-ink-tertiary-light mt-2">
                        {selectedWards.length} of {wardsForMuni.length} ward
                        {wardsForMuni.length === 1 ? "" : "s"} selected
                      </Text>
                    </>
                  )}
                </AppCard>
              </>
            ) : role === "supervisor" && selectedMuni ? (
              <Banner
                tone="info"
                title="ULB-wide access"
                message={`${user.name} will review surveys across all wards in ${selectedMuni.name}.`}
                icon="information-circle-outline"
                className="mb-4"
              />
            ) : null}
          </>
        ) : (
          <Banner
            tone="warning"
            title="Granting admin access"
            message="Admins manage users, approvals, and all master data. Confirm this is intended."
            icon="warning-outline"
            className="mb-4"
          />
        )}
      </ScrollView>

      <View
        className="absolute left-0 right-0 bottom-0 px-4 pt-3 border-t border-line-subtle bg-surface-light dark:bg-surface-dark"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <AppButton
          label={submitting ? "Approving…" : "Approve and grant access"}
          loading={submitting}
          onPress={handleApprove}
          disabled={!scopeReady}
          fullWidth
          iconRight="checkmark-circle"
        />
        {!scopeReady ? (
          <Text className="text-caption text-ink-tertiary-light text-center mt-2">
            {role === "surveyor"
              ? "Select a municipality and at least one ward."
              : role === "supervisor"
                ? "Select a municipality."
                : "Confirm admin access above."}
          </Text>
        ) : null}
      </View>

      {toast ? (
        <Toast visible title={toast.title} tone={toast.tone} onHide={() => setToast(null)} />
      ) : null}
    </View>
  );
}

function EmptyFallback({
  icon,
  title,
  message,
  onBack,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <>
      <Ionicons name={icon} size={40} color="#9AA3AF" />
      <Text className="text-h3 font-medium text-ink-primary-light mt-3">{title}</Text>
      <Text className="text-helper text-ink-tertiary-light text-center mt-1">{message}</Text>
      <AppButton label="Go back" variant="outline" onPress={onBack} className="mt-5" />
    </>
  );
}
