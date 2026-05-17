import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-page-light px-6 dark:bg-page-dark">
        <Text className="text-h2 font-medium text-ink-primary-light dark:text-ink-primary-dark">Page not found</Text>
        <Text className="text-body text-ink-tertiary-light dark:text-ink-tertiary-dark mt-2 text-center">
          This screen does not exist or the link is outdated.
        </Text>
        <Link href="/dashboard" className="mt-6 text-brand font-medium text-body">
          Go to home
        </Link>
      </View>
    </>
  );
}
