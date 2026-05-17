import { AppButton } from "@/components";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FloatingSaveBarProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  loading?: boolean;
}

export function FloatingSaveBar({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  loading,
}: FloatingSaveBarProps) {
  return (
    <SafeAreaView
      edges={["bottom"]}
      className="border-t border-line-subtle bg-surface-light dark:bg-surface-dark px-4 pt-3"
    >
      <View className="flex-row gap-2">
        {onBack ? (
          <View className="flex-1">
            <AppButton label="Back" variant="outline" onPress={onBack} fullWidth />
          </View>
        ) : null}
        <View className={onBack ? "flex-[2]" : "flex-1"}>
          <AppButton
            label={nextLabel}
            onPress={onNext}
            loading={loading}
            disabled={nextDisabled}
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
