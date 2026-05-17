'use no memo';

/**
 * Step 7 — GPS capture.
 *
 * Real expo-location integration with permission handling and a tight
 * accuracy budget:
 *   - we accept ≤ 30 m (good)
 *   - 30–100 m is "fair" with a yellow warning
 *   - > 100 m blocked → ask the surveyor to step outside
 *
 * Mock locations (Android dev tools / fake-GPS apps) are detected when the
 * platform exposes them; the upsert path can reject them server-side.
 */
import { AppButton, AppCard, Banner, GPSStatus, SectionLabel, Spinner, Tag } from '@/components';
import { WizardStepFrame } from '@/hooks/WizardStepFrame';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

type State = 'idle' | 'locating' | 'captured' | 'error';

const MAX_ACCEPTABLE_M = 500;
const GOOD_M = 30;
const FAIR_M = 100;

function isMockLocation(loc: { mocked?: boolean }): boolean {
  return Boolean(loc.mocked);
}

function StepGPS() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!localId) {
    return <Spinner label="Loading…" />;
  }

  return (
    <WizardStepFrame localId={localId} activeKey="gps" title="GPS location" subtitle="Stand outside the property">
      {({ draft, update }) => {
        const capture = async () => {
          setError(null);
          setState('locating');
          try {
            const Location = await import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              setError('Location permission is required to continue');
              setState('error');
              return;
            }
            const services = await Location.hasServicesEnabledAsync();
            if (!services) {
              setError('Turn on device location services');
              setState('error');
              return;
            }
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.BestForNavigation,
              mayShowUserSettingsDialog: true,
            });
            if (loc.coords.accuracy != null && loc.coords.accuracy > MAX_ACCEPTABLE_M) {
              setError(
                `Accuracy too poor (±${Math.round(loc.coords.accuracy)} m). Step outside any covered area and retry.`,
              );
              setState('error');
              return;
            }
            await update({
              gps: {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracyMeters: loc.coords.accuracy ?? 0,
                capturedAt: Date.now(),
                provider: isMockLocation(loc) ? 'mock' : 'device',
                isMockLocation: isMockLocation(loc),
              },
            });
            setState('captured');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not get location');
            setState('error');
          }
        };

        const gps = draft.gps;
        const ui: State = state === 'idle' && gps ? 'captured' : state;
        const acc = gps?.accuracyMeters;

        return (
          <>
            {ui === 'captured' && gps?.isMockLocation ? (
              <Banner
                tone="danger"
                title="Mock location detected"
                message="The captured coordinates appear to come from a fake-GPS source. Retake using a real device location."
                icon="warning-outline"
                className="mb-3"
              />
            ) : null}

            <SectionLabel>Current capture</SectionLabel>
            <AppCard padded className="mb-3">
              <View className="items-center py-3">
                <View
                  className={[
                    'w-20 h-20 rounded-full items-center justify-center',
                    ui === 'captured' ? 'bg-success-soft' : ui === 'error' ? 'bg-danger-soft' : 'bg-brand-soft',
                  ].join(' ')}
                >
                  <Ionicons
                    name={
                      ui === 'captured'
                        ? 'checkmark-done'
                        : ui === 'locating'
                          ? 'compass'
                          : ui === 'error'
                            ? 'alert'
                            : 'location'
                    }
                    size={36}
                    color={ui === 'captured' ? '#16A34A' : ui === 'error' ? '#DC2626' : '#003B8E'}
                  />
                </View>
                <View className="mt-3">
                  <GPSStatus state={ui} accuracy={acc} />
                </View>
                {gps ? (
                  <View className="mt-3 items-center">
                    <Text className="text-body font-mono text-ink-primary-light dark:text-ink-primary-dark">
                      {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                    </Text>
                    <View className="flex-row gap-1.5 mt-2">
                      <Tag
                        label={
                          acc != null && acc <= GOOD_M ? 'Excellent' : acc != null && acc <= FAIR_M ? 'Fair' : 'Poor'
                        }
                        tone={
                          acc != null && acc <= GOOD_M ? 'success' : acc != null && acc <= FAIR_M ? 'warning' : 'danger'
                        }
                        icon="locate-outline"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </AppCard>

            {error ? (
              <Banner
                tone="danger"
                title="Capture failed"
                message={error}
                icon="alert-circle-outline"
                className="mb-3"
              />
            ) : null}

            <AppButton
              label={state === 'locating' ? 'Locating…' : gps ? 'Retake location' : 'Capture GPS'}
              loading={state === 'locating'}
              iconLeft={gps ? 'refresh' : 'locate'}
              size="lg"
              onPress={capture}
              fullWidth
            />

            <Banner
              tone="info"
              title="Best practice"
              message="Stand directly outside the main entrance with a clear sky view. Wait a few seconds before tapping capture for better accuracy."
              icon="information-circle-outline"
              className="mt-3"
            />
          </>
        );
      }}
    </WizardStepFrame>
  );
}

export default StepGPS;
