import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function SetupScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#003B8E" size="large" />
      <Text style={styles.text}>waiting for approval</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  text: { color: "#003B8E" },
});
