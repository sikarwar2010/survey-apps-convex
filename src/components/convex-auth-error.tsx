import { authStyles } from "@/components/auth/styles";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Shown when Clerk is signed in but Convex cannot validate the JWT.
 * Without this, AuthGate spins forever and user rows are never created.
 */
export function ConvexAuthError() {
  return (
    <SafeAreaView style={authStyles.safe}>
      <ScrollView contentContainerStyle={authStyles.scroll}>
        <Text style={authStyles.title}>Convex + Clerk not linked</Text>
        <Text style={authStyles.subtitle}>
          Your Clerk session is active, but Convex is not accepting auth tokens. Fix
          the items below, then restart the app.
        </Text>

        <View style={{ marginTop: 16, gap: 12 }}>
          <Step
            n={1}
            title="Clerk JWT template"
            body='In Clerk Dashboard → JWT Templates → New template. Name it exactly "convex". Use the Convex preset (audience must be "convex").'
          />
          <Step
            n={2}
            title="Convex issuer domain"
            body='Run: npx convex env set CLERK_JWT_ISSUER_DOMAIN https://YOUR-INSTANCE.clerk.accounts.dev (same issuer as the template).'
          />
          <Step
            n={3}
            title="Redeploy Convex auth"
            body="Run npx convex dev (or convex dev --once) so auth.config.ts picks up the env var."
          />
          <Step
            n={4}
            title="Sync backend"
            body="Keep npx convex dev running while developing so users.provisionCurrentUser is deployed."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View>
      <Text style={[authStyles.label, { marginBottom: 4 }]}>
        {n}. {title}
      </Text>
      <Text style={authStyles.subtitle}>{body}</Text>
    </View>
  );
}
