import { clerkErrorMessage } from "@/components/auth/field-error";
import { authColors, authStyles } from "@/components/auth/styles";
import { useAuth } from "@clerk/expo";
import { useSignUp } from "@clerk/expo/legacy";
import { Link } from "expo-router";
import { useState } from "react";
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

export default function SignUpScreen() {
  const { isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const onSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setBusy(true);
    setFormError("");
    try {
      await signUp.create({ emailAddress, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded || !signUp) return;
    setBusy(true);
    setFormError("");
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActive?.({ session: attempt.createdSessionId });
      }
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!signUp) return;
    setFormError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err) {
      setFormError(clerkErrorMessage(err));
    }
  };

  if (!isLoaded) {
    return (
      <View style={loadingStyle}>
        <ActivityIndicator color="#003B8E" size="large" />
      </View>
    );
  }

  if (isSignedIn) return null;

  if (verifying) {
    return (
      <SafeAreaView style={authStyles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={authStyles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={authStyles.title}>Verify your email</Text>
            <Text style={authStyles.subtitle}>
              We sent a verification code to {emailAddress || "your email"}.
            </Text>

            <TextInput
              style={authStyles.input}
              value={code}
              placeholder="Verification code"
              placeholderTextColor="#9CA3AF"
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
            {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

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

            <Pressable
              style={({ pressed }) => [
                authStyles.secondaryButton,
                pressed && authStyles.buttonPressed,
              ]}
              onPress={resendCode}
            >
              <Text style={authStyles.secondaryButtonText}>Send a new code</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={authStyles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={authStyles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={authStyles.title}>Create account</Text>
          <Text style={authStyles.subtitle}>Request access to the survey app</Text>

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
            textContentType="newPassword"
          />
          {formError ? <Text style={authStyles.error}>{formError}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              authStyles.button,
              (!emailAddress || !password || busy) && authStyles.buttonDisabled,
              pressed && authStyles.buttonPressed,
            ]}
            onPress={onSignUp}
            disabled={!emailAddress || !password || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={authStyles.buttonText}>Sign up</Text>
            )}
          </Pressable>

          <View style={authStyles.linkRow}>
            <Text style={authStyles.linkMuted}>Already have an account?</Text>
            <Link href="/(auth)/sign-in">
              <Text style={authStyles.link}>Sign in</Text>
            </Link>
          </View>

          <View nativeID="clerk-captcha" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
