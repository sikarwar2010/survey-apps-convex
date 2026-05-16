import { Alert, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { useQuery } from "convex/react";
import { AppButton, AppCard, Avatar, ListRow, SectionLabel, Spinner, Tag } from "@/components";
import { api } from "@/convex/_generated/api";
import { humanizeRole } from "@/utils/format";

export default function AdminProfileScreen() {
  const me = useQuery(api.users.currentUser, {});
  const { signOut } = useAuth();
  if (!me) return <Spinner label="Loading…" />;

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to continue.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-brand">
        <View className="items-center pt-3 pb-6">
          <Avatar name={me.name} tone="brand" size="xl" />
          <Text className="text-h2 font-medium text-white mt-2.5">{me.name}</Text>
          <Text className="text-caption text-white/75 mt-0.5">{me.email}</Text>
          <View className="mt-2 flex-row gap-1.5">
            <Tag label={humanizeRole(me.role)} tone="brand" icon="shield-checkmark-outline" />
          </View>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
        <SectionLabel>Admin tools</SectionLabel>
        <AppCard padded={false} className="mb-4">
          <ListRow icon="bulb-outline" iconTone="brand" title="Approvals" subtitle="Pending sign-ups" />
          <View className="h-px bg-line-subtle" />
          <ListRow icon="people-outline" iconTone="neutral" title="Users" />
          <View className="h-px bg-line-subtle" />
          <ListRow icon="library-outline" iconTone="neutral" title="Masters" />
        </AppCard>
        <AppButton label="Sign out" variant="outline" iconLeft="log-out-outline" onPress={onSignOut} fullWidth />
      </ScrollView>
    </View>
  );
}
