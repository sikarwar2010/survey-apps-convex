/**
 * Admin → Pending approvals.
 *
 * Reactive Convex query. The moment a user signs up via the Clerk
 * webhook, the row appears here without a refresh.
 */
import {
  AppButton,
  Avatar,
  Banner,
  EmptyState,
  Spinner,
  Tag,
  Toast,
} from "@/components";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUserMessage } from "@/utils/errors";
import { timeAgo } from "@/utils/format";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ApprovalsScreen() {
  const router = useRouter();
  const pending = useQuery(api.admin.listPendingApprovals, {});
  const rejectUser = useMutation(api.admin.rejectUser);
  const [toast, setToast] = useState<{ title: string; tone: "success" | "danger" } | null>(null);
  const [busyId, setBusyId] = useState<Id<"users"> | null>(null);

  const onReject = (id: Id<"users">, name: string) => {
    Alert.alert(
      "Reject account?",
      `${name} will be permanently denied access. They can be reactivated later from Users.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setBusyId(id);
            try {
              await rejectUser({ userId: id });
              setToast({ title: "User rejected", tone: "success" });
            } catch (e) {
              setToast({ title: toUserMessage(e), tone: "danger" });
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-brand">
        <View className="px-4 pt-2 pb-5">
          <Text className="text-helper text-white/65">Admin</Text>
          <Text className="text-h1 font-medium text-white mt-0.5">Approvals</Text>
          <Text className="text-caption text-white/75 mt-1">
            {pending?.length ?? 0} pending{" "}
            {pending && pending.length === 1 ? "request" : "requests"}
          </Text>
        </View>
      </SafeAreaView>

      {pending === undefined ? (
        <Spinner label="Loading…" />
      ) : pending.length === 0 ? (
        <View className="px-4 mt-4">
          <Banner
            tone="success"
            title="All caught up"
            message="No accounts are awaiting approval right now. New sign-ups appear here in real time."
          />
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Inbox empty"
            message="When someone signs up, they'll appear here for review."
          />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(admin)/approve-detail",
                  params: { userId: item._id },
                })
              }
              className="p-3.5 bg-surface-light dark:bg-surface-dark rounded-xl border border-line-subtle"
            >
              <View className="flex-row items-start">
                <Avatar name={item.name} tone="warning" size="md" />
                <View className="flex-1 ml-3">
                  <Text className="text-[13px] font-medium text-ink-primary-light dark:text-ink-primary-dark">
                    {item.name}
                  </Text>
                  <Text className="text-caption text-ink-tertiary-light dark:text-ink-tertiary-dark mt-0.5">
                    {item.email}
                  </Text>
                  <View className="flex-row gap-1.5 mt-1.5">
                    <Tag
                      label={item.requestedRole ?? "Not specified"}
                      tone="brand"
                      icon="briefcase-outline"
                    />
                    <Tag label={timeAgo(new Date(item.createdAt).toISOString())} tone="neutral" icon="time-outline" />
                  </View>
                  {item.requestedReason ? (
                    <Text
                      className="text-caption text-ink-tertiary-light dark:text-ink-tertiary-dark mt-1.5"
                      numberOfLines={2}
                    >
                      "{item.requestedReason}"
                    </Text>
                  ) : null}
                </View>
              </View>

              <View className="flex-row gap-2 mt-3">
                <AppButton
                  label="Reject"
                  variant="outline"
                  size="sm"
                  iconLeft="close-outline"
                  onPress={() => onReject(item._id, item.name)}
                  loading={busyId === item._id}
                  className="flex-1"
                />
                <AppButton
                  label="Review & approve"
                  size="sm"
                  iconRight="arrow-forward"
                  onPress={() =>
                    router.push({
                      pathname: "/(admin)/approve-detail",
                      params: { userId: item._id as string },
                    })
                  }
                  className="flex-1"
                />
              </View>
            </Pressable>
          )}
        />
      )}

      {toast ? (
        <Toast visible title={toast.title} tone={toast.tone} onHide={() => setToast(null)} />
      ) : null}
    </View>
  );
}
