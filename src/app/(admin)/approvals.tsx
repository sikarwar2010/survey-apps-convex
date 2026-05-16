import { StyleSheet, Text, View } from "react-native";

export default function ApprovalsScreen() {
  return (
    <View style={styles.container}>
      <Text>Admin approvals</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
