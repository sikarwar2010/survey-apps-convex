import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

/** Stub tab — pressing "New" routes straight into the wizard. */
export default function NewSurveyTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(app)/survey/wizard");
  }, [router]);
  return <View className="flex-1 bg-page-light dark:bg-page-dark" />;
}
