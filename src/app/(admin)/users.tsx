import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { Avatar, EmptyState, Spinner, Tag } from "@/components";
import { api } from "@/convex/_generated/api";
import { humanizeRole, timeAgo } from "@/utils/format";

const ROLES = [
  { value: undefined, label: "All" },
  { value: "surveyor", label: "Surveyors" },
  { value: "supervisor", label: "Supervisors" },
  { value: "admin", label: "Admins" },
  { value: "pending", label: "Pending" },
] as const;

export default function AdminUsersScreen() {
  const [role, setRole] = useState<string | undefined>(undefined);
  const users = useQuery(api.admin.listUsers, { role: role as never });

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-surface-light dark:bg-surface-dark border-b border-line-subtle">
        <View className="px-4 pt-2 pb-3">
          <Text className="text-h1 font-medium text-ink-primary-light dark:text-ink-primary-dark">Users</Text>
        </View>
        <View className="px-4 pb-3 flex-row gap-1.5 flex-wrap">
          {ROLES.map((r) => {
            const active = role === r.value;
            return (
              <Pressable
                key={r.label}
                onPress={() => setRole(r.value)}
                className={`px-3 py-1.5 rounded-full border ${active ? "bg-brand border-brand" : "border-line-default"}`}
              >
                <Text className={`text-[12px] font-medium ${active ? "text-white" : "text-ink-secondary-light dark:text-ink-secondary-dark"}`}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      {users === undefined ? (
        <Spinner label="Loading…" />
      ) : users.length === 0 ? (
        <EmptyState icon="people-outline" title="No users" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <View className="p-3.5 bg-surface-light dark:bg-surface-dark rounded-xl border border-line-subtle">
              <View className="flex-row items-center">
                <Avatar
                  name={item.name}
                  tone={item.status === "active" ? "brand" : item.status === "disabled" ? "danger" : "warning"}
                  size="md"
                />
                <View className="flex-1 ml-3">
                  <Text className="text-[13px] font-medium text-ink-primary-light dark:text-ink-primary-dark">
                    {item.name}
                  </Text>
                  <Text className="text-caption text-ink-tertiary-light">{item.email}</Text>
                </View>
                <Tag label={humanizeRole(item.role)} tone={item.role === "admin" ? "brand" : "neutral"} />
              </View>
              <View className="flex-row gap-1.5 mt-2 flex-wrap">
                {item.municipalityName ? <Tag label={item.municipalityName} tone="neutral" icon="business-outline" /> : null}
                {item.wardAssignments.length > 0 ? (
                  <Tag label={`Wards: ${item.wardAssignments.join(", ")}`} tone="neutral" icon="map-outline" />
                ) : null}
                {item.status === "active" ? (
                  <Tag label="Active" tone="success" icon="checkmark-circle" />
                ) : item.status === "disabled" ? (
                  <Tag label="Disabled" tone="danger" icon="ban" />
                ) : (
                  <Tag label="Pending" tone="warning" icon="time" />
                )}
                {item.lastSeenAt ? (
                  <Tag label={`Seen ${timeAgo(item.lastSeenAt)}`} tone="neutral" icon="eye-outline" />
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
