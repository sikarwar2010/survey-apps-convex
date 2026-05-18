import { BrandLogo } from '@/components/brand-logo';
import { ActivityIndicator, Text, View } from 'react-native';

type AppLoadingViewProps = {
  message: string;
};

/** Full-screen branded loader (splash handoff, auth gate, session setup). */
export function AppLoadingView({ message }: AppLoadingViewProps) {
  return (
    <View className="flex-1 items-center justify-center bg-page-light px-8 dark:bg-page-dark">
      <BrandLogo width={260} framed animated />
      <View className="mt-8">
        <ActivityIndicator color="#003B8E" size="large" />
      </View>
      <Text className="mt-4 max-w-[280px] text-center text-helper text-ink-tertiary-light dark:text-ink-tertiary-dark">
        {message}
      </Text>
    </View>
  );
}
