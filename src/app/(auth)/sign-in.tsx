import { clerkErrorMessage } from "@/components/auth/field-error";
import { authColors, authStyles } from "@/components/auth/styles";
import { useAuth } from "@clerk/expo";
import { useSignIn } from "@clerk/expo/legacy";
import type { EmailCodeFactor, TOTPFactor } from "@clerk/shared/types";
import { Link } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInScreen() {
  const { isSignedIn } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [emailCodeRequired, setEmailCodeRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const finalizeSession = async (sessionId: string | null) => {
    if (!sessionId || !setActive) return;
    await setActive({ session: sessionId });
  };

  const onSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setFormError("");
    try {
      const attempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (attempt.status === "complete") {
        await finalizeSession(attempt.createdSessionId);
        return;
      }

      if (attempt.status === "needs_second_factor") {
        const emailCodeFactor = attempt.supportedSecondFactors?.find(
          (factor): factor is EmailCodeFactor => factor.strategy === "email_code",
        );
        if (emailCodeFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setEmailCodeRequired(true);
          return;
        }

        const hasTotp = attempt.supportedSecondFactors?.some(
          (factor): factor is TOTPFactor => factor.strategy === "totp",
        );
        if (hasTotp) {
          setMfaRequired(true);
        }
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyMfa = async () => {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setFormError("");
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: "totp",
        code,
      });
      if (attempt.status === "complete") {
        await finalizeSession(attempt.createdSessionId);
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyEmailCode = async () => {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    setFormError("");
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });
      if (attempt.status === "complete") {
        await finalizeSession(attempt.createdSessionId);
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resetFlow = () => {
    setCode("");
    setMfaRequired(false);
    setEmailCodeRequired(false);
    setFormError("");
  };

  if (!isLoaded) {
    return (
      <View style={loadingStyle}>
        <ActivityIndicator color="#003B8E" size="large" />
      </View>
    );
  }

  if (isSignedIn) return null;

  if (emailCodeRequired) {
    return (
      <AuthShell title="Verify your account" subtitle="Enter the code sent to your email.">
        <CodeForm
          code={code}
          onChangeCode={setCode}
          codeError={formError}
          busy={busy}
          onVerify={onVerifyEmailCode}
          onResend={async () => {
            const factor = signIn?.supportedSecondFactors?.find(
              (f): f is EmailCodeFactor => f.strategy === "email_code",
            );
            if (factor) {
              await signIn?.prepareSecondFactor({
                strategy: "email_code",
                emailAddressId: factor.emailAddressId,
              });
            }
          }}
          onReset={resetFlow}
        />
      </AuthShell>
    );
  }

  if (mfaRequired) {
    return (
      <AuthShell
        title="Two-factor authentication"
        subtitle="Enter the code from your authenticator app."
      >
        <CodeForm
          code={code}
          onChangeCode={setCode}
          codeError={formError}
          busy={busy}
          onVerify={onVerifyMfa}
          onReset={resetFlow}
          resetLabel="Start over"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in" subtitle="Survey field operations">
      <Text style={authStyles.label}>Email</Text>
      <TextInput
        style={authStyles.input}
        autoCapitalize="none"
        autoComplete="email"
        value={emailAddress}
        placeholder="you@company.com"
        placeholderTextColor="#9CA3AF"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <Text style={authStyles.label}>Password</Text>
      <TextInput
        style={authStyles.input}
        value={password}
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        onChangeText={setPassword}
        textContentType="password"
      />
      {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          authStyles.button,
          (!emailAddress || !password || busy) && authStyles.buttonDisabled,
          pressed && authStyles.buttonPressed,
        ]}
        onPress={onSignIn}
        disabled={!emailAddress || !password || busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.buttonText}>Sign in</Text>
        )}
      </Pressable>

      <View style={authStyles.linkRow}>
        <Text style={authStyles.linkMuted}>No account?</Text>
        <Link href="/(auth)/sign-up">
          <Text style={authStyles.link}>Sign up</Text>
        </Link>
      </View>
    </AuthShell>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={authStyles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={authStyles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={authStyles.title}>{title}</Text>
          <Text style={authStyles.subtitle}>{subtitle}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CodeForm({
  code,
  onChangeCode,
  codeError,
  busy,
  onVerify,
  onResend,
  onReset,
  resetLabel = "Start over",
}: {
  code: string;
  onChangeCode: (value: string) => void;
  codeError?: string;
  busy: boolean;
  onVerify: () => void;
  onResend?: () => void;
  onReset: () => void;
  resetLabel?: string;
}) {
  return (
    <>
      <TextInput
        style={authStyles.input}
        value={code}
        placeholder="Verification code"
        placeholderTextColor="#9CA3AF"
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
      />
      {codeError ? <Text style={authStyles.error}>{codeError}</Text> : null}
      <Pressable
        style={({ pressed }) => [
          authStyles.button,
          (!code || busy) && authStyles.buttonDisabled,
          pressed && authStyles.buttonPressed,
        ]}
        onPress={onVerify}
        disabled={!code || busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={authStyles.buttonText}>Verify</Text>
        )}
      </Pressable>
      {onResend ? (
        <Pressable
          style={({ pressed }) => [authStyles.secondaryButton, pressed && authStyles.buttonPressed]}
          onPress={onResend}
        >
          <Text style={authStyles.secondaryButtonText}>Send a new code</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={({ pressed }) => [authStyles.secondaryButton, pressed && authStyles.buttonPressed]}
        onPress={onReset}
      >
        <Text style={authStyles.secondaryButtonText}>{resetLabel}</Text>
      </Pressable>
    </>
  );
}

const loadingStyle = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: authColors.background,
  },
}).container;
