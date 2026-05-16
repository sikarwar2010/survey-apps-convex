import { authStyles } from "@/components/auth/styles";
import { Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function AppErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <SafeAreaView style={authStyles.safe}>
      <ScrollView contentContainerStyle={authStyles.scroll}>
        <Text style={authStyles.title}>Something went wrong</Text>
        <Text style={authStyles.subtitle}>{error.message}</Text>
        <Pressable style={authStyles.button} onPress={retry}>
          <Text style={authStyles.buttonText}>Try again</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
