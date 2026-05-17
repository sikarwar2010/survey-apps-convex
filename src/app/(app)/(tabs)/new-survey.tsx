import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

/** Stub tab — pressing "New" opens the wizard stack (not a tab route). */
export default function NewSurveyTab() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      router.replace('/(app)/wizard');
    }, [router]),
  );

  return <View className="flex-1 bg-page-light dark:bg-page-dark" />;
}
