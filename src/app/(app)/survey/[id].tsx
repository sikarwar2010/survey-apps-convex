/**
 * Survey detail.
 *
 * Surveyor: read-only after submit; can edit fields and add photos while draft.
 * Supervisor/admin: can leave QC remarks and approve/reject.
 */
import {
  AppButton,
  AppCard,
  AppDropdown,
  AppInput,
  Banner,
  ListRow,
  SectionLabel,
  Spinner,
  StatusBadge,
  Tag,
  Toast,
} from "@/components";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uploadImageFromUri } from "@/utils/convex-storage";
import { toUserMessage } from "@/utils/errors";
import { formatArea, humanizeRole, timeAgo } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function newFloorId(): string {
  return `lf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SurveyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id as Id<"surveys"> | undefined;
  const me = useQuery(api.users.currentUser, {});
  const masters = useQuery(api.masters.bundle, {});
  const survey = useQuery(api.surveys.get, id ? { id } : "skip");
  const submit = useMutation(api.surveys.submit);
  const setGps = useMutation(api.surveys.setGps);
  const upsertFloor = useMutation(api.floors.upsert);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const linkPhoto = useMutation(api.photos.linkPhoto);
  const decide = useMutation(api.qc.decide);
  const [toast, setToast] = useState<{ title: string; tone: "success" | "danger" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFloorForm, setShowFloorForm] = useState(false);
  const [floorForm, setFloorForm] = useState({
    floorName: "",
    usageType: "",
    constructionType: "",
    areaSqft: "",
    isOccupied: true,
  });

  if (!id || me === undefined) return <Spinner label="Loading…" />;
  if (survey === undefined || masters === undefined) return <Spinner label="Loading survey…" />;
  if (survey === null) {
    return (
      <View className="flex-1 items-center justify-center bg-page-light p-6">
        <Text className="text-h2 text-ink-primary-light">Survey not found</Text>
      </View>
    );
  }

  const canEdit = me?.role === "surveyor"
    ? survey.surveyorId === me._id && survey.qcStatus !== "approved"
    : me?.role === "supervisor" || me?.role === "admin";
  const canSubmit = canEdit && (survey.status === "draft" || survey.status === "rejected");
  const canReview = (me?.role === "supervisor" || me?.role === "admin") &&
    survey.status === "submitted" &&
    survey.qcStatus !== "approved";

  const photoSlots: { slot: "front" | "side"; label: string }[] = [
    { slot: "front", label: "Front" },
    { slot: "side", label: "Side" },
  ];
  const photosBySlot = new Map(survey.photos.map((p) => [p.slot, p]));

  const doSubmit = async () => {
    setBusy(true);
    try {
      await submit({ id });
      setToast({ title: "Submitted for review", tone: "success" });
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const captureGps = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setToast({ title: "Location permission is required", tone: "danger" });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await setGps({
        id,
        gps: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy ?? 999,
          capturedAt: Date.now(),
          provider: "expo-location",
        },
      });
      setToast({ title: "GPS captured", tone: "success" });
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const capturePhoto = async (slot: "front" | "side") => {
    setBusy(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setToast({ title: "Camera permission is required", tone: "danger" });
        return;
      }
      const picked = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
      });
      if (picked.canceled || !picked.assets[0]) return;

      const uploadUrl = await generateUploadUrl({});
      const { storageId, sizeKb } = await uploadImageFromUri(uploadUrl, picked.assets[0].uri);
      await linkPhoto({
        surveyId: id,
        slot,
        storageId,
        sizeKb,
        width: picked.assets[0].width,
        height: picked.assets[0].height,
        capturedAt: Date.now(),
      });
      setToast({ title: `${humanizeRole(slot)} photo saved`, tone: "success" });
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const addFloor = async () => {
    const area = parseFloat(floorForm.areaSqft);
    if (!floorForm.floorName || !floorForm.usageType || !floorForm.constructionType || !area) {
      setToast({ title: "Fill all floor fields", tone: "danger" });
      return;
    }
    setBusy(true);
    try {
      await upsertFloor({
        surveyId: id,
        clientFloorId: newFloorId(),
        position: survey.floors.length,
        floorName: floorForm.floorName,
        usageType: floorForm.usageType,
        constructionType: floorForm.constructionType,
        isOccupied: floorForm.isOccupied,
        areaSqft: area,
      });
      setFloorForm({
        floorName: "",
        usageType: "",
        constructionType: "",
        areaSqft: "",
        isOccupied: true,
      });
      setShowFloorForm(false);
      setToast({ title: "Floor added", tone: "success" });
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const doDecide = (decision: "approve" | "reject") => {
    Alert.alert(
      decision === "approve" ? "Approve survey?" : "Reject survey?",
      decision === "approve"
        ? "The surveyor will be notified and the record will be locked."
        : "The surveyor will be notified to make corrections.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "approve" ? "Approve" : "Reject",
          style: decision === "reject" ? "destructive" : "default",
          onPress: async () => {
            setBusy(true);
            try {
              await decide({ surveyId: id, decision });
              setToast({
                title: decision === "approve" ? "Approved" : "Rejected",
                tone: decision === "approve" ? "success" : "danger",
              });
            } catch (e) {
              setToast({ title: toUserMessage(e), tone: "danger" });
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-brand">
        <View className="px-4 py-3 flex-row items-center">
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" onPress={() => router.back()} />
          <View className="flex-1 ml-2">
            <Text className="text-helper text-white/75">Survey · v{survey.serverVersion}</Text>
            <Text className="text-h3 font-medium text-white" numberOfLines={1}>
              {survey.propertyNo}
            </Text>
          </View>
        </View>
        <View className="px-4 pb-3 flex-row gap-1.5 flex-wrap">
          <StatusBadge status={survey.status} />
          {survey.qcStatus !== "pending" ? (
            <Tag
              label={`QC: ${survey.qcStatus}`}
              tone={survey.qcStatus === "approved" ? "success" : "danger"}
              icon={survey.qcStatus === "approved" ? "checkmark-circle" : "alert"}
            />
          ) : null}
          <Tag label={`Ward ${survey.wardNo}`} tone="neutral" icon="map-outline" />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
        {survey.qcStatus === "rejected" ? (
          <Banner
            tone="danger"
            icon="alert-circle"
            title="Returned by supervisor"
            message="Update the survey, add required floors/photos/GPS, then submit again."
            className="mb-3"
          />
        ) : null}

        {canEdit && (survey.status === "draft" || survey.status === "rejected") ? (
          <AppButton
            label="Edit property details"
            variant="outline"
            iconLeft="create-outline"
            onPress={() => router.push({ pathname: "/(app)/survey/wizard", params: { id } })}
            className="mb-3"
            fullWidth
          />
        ) : null}

        <SectionLabel>Location</SectionLabel>
        <AppCard padded className="mb-3">
          {survey.gps ? (
            <Text className="text-body text-ink-primary-light dark:text-ink-primary-dark">
              {survey.gps.latitude.toFixed(5)}, {survey.gps.longitude.toFixed(5)}
              {" · "}±{Math.round(survey.gps.accuracyMeters)}m
            </Text>
          ) : (
            <Text className="text-helper text-ink-tertiary-light">GPS not captured yet</Text>
          )}
          {canEdit && (survey.status === "draft" || survey.status === "rejected") ? (
            <AppButton
              label={survey.gps ? "Retake GPS" : "Capture GPS"}
              variant="outline"
              iconLeft="location-outline"
              onPress={captureGps}
              loading={busy}
              className="mt-3"
              fullWidth
            />
          ) : null}
        </AppCard>

        <SectionLabel>Owner</SectionLabel>
        <AppCard padded={false} className="mb-3">
          <ListRow icon="person-outline" iconTone="brand" title="Owner" subtitle={survey.ownerName} showChevron={false} />
          <View className="h-px bg-line-subtle" />
          <ListRow icon="call-outline" iconTone="neutral" title="Mobile" subtitle={survey.mobileNo} showChevron={false} />
          <View className="h-px bg-line-subtle" />
          <ListRow icon="people-outline" iconTone="neutral" title="Family size" subtitle={`${survey.familySize}`} showChevron={false} />
        </AppCard>

        <SectionLabel>Address</SectionLabel>
        <AppCard padded className="mb-3">
          <Text className="text-body text-ink-primary-light dark:text-ink-primary-dark">
            {survey.houseNo}, {survey.street}
            {survey.locality ? `, ${survey.locality}` : ""}
          </Text>
          <Text className="text-helper text-ink-tertiary-light dark:text-ink-tertiary-dark mt-1">
            {survey.city} — {survey.pinCode}
          </Text>
        </AppCard>

        <SectionLabel>Taxation</SectionLabel>
        <AppCard padded={false} className="mb-3">
          <ListRow title="Assessment year" subtitle={survey.assessmentYear} showChevron={false} />
          <View className="h-px bg-line-subtle" />
          <ListRow title="Property type" subtitle={humanizeRole(survey.propertyType)} showChevron={false} />
          <View className="h-px bg-line-subtle" />
          <ListRow title="Use" subtitle={humanizeRole(survey.propertyUse)} showChevron={false} />
          <View className="h-px bg-line-subtle" />
          <ListRow title="Plot · Plinth" subtitle={`${formatArea(survey.plotSqft)} · ${formatArea(survey.plinthSqft)}`} showChevron={false} />
        </AppCard>

        <SectionLabel>Floors ({survey.floors.length})</SectionLabel>
        <AppCard padded={false} className="mb-3">
          {survey.floors.length === 0 ? (
            <View className="p-4 items-center">
              <Text className="text-helper text-ink-tertiary-light">No floors yet</Text>
            </View>
          ) : (
            survey.floors.map((f, i) => (
              <View key={f._id}>
                {i > 0 ? <View className="h-px bg-line-subtle" /> : null}
                <ListRow
                  title={`${f.floorName} · ${humanizeRole(f.usageType)}`}
                  subtitle={`${formatArea(f.areaSqft)} · ${humanizeRole(f.constructionType)}${f.isOccupied ? "" : " · vacant"}`}
                  showChevron={false}
                />
              </View>
            ))
          )}
          {canEdit && (survey.status === "draft" || survey.status === "rejected") ? (
            <View className="p-3 border-t border-line-subtle">
              {showFloorForm ? (
                <View className="gap-3">
                  <AppDropdown
                    placeholder="Floor name"
                    value={floorForm.floorName}
                    options={masters.floors}
                    onChange={(v) => setFloorForm((f) => ({ ...f, floorName: v }))}
                  />
                  <AppDropdown
                    placeholder="Usage"
                    value={floorForm.usageType}
                    options={masters.usageTypes}
                    onChange={(v) => setFloorForm((f) => ({ ...f, usageType: v }))}
                  />
                  <AppDropdown
                    placeholder="Construction"
                    value={floorForm.constructionType}
                    options={masters.constructionTypes}
                    onChange={(v) => setFloorForm((f) => ({ ...f, constructionType: v }))}
                  />
                  <AppInput
                    label="Area (sq ft)"
                    keyboardType="decimal-pad"
                    value={floorForm.areaSqft}
                    onChangeText={(v) => setFloorForm((f) => ({ ...f, areaSqft: v }))}
                  />
                  <View className="flex-row gap-2">
                    <AppButton label="Cancel" variant="ghost" onPress={() => setShowFloorForm(false)} className="flex-1" />
                    <AppButton label="Add floor" onPress={addFloor} loading={busy} className="flex-1" />
                  </View>
                </View>
              ) : (
                <AppButton
                  label="Add floor"
                  variant="outline"
                  iconLeft="add-outline"
                  onPress={() => setShowFloorForm(true)}
                  fullWidth
                />
              )}
            </View>
          ) : null}
        </AppCard>

        <SectionLabel>Photos ({survey.photos.length})</SectionLabel>
        <AppCard padded className="mb-3">
          {survey.photos.length === 0 && !canEdit ? (
            <Text className="text-helper text-ink-tertiary-light text-center py-2">No photos</Text>
          ) : null}
          <View className="flex-row gap-2 flex-wrap">
            {photoSlots.map(({ slot, label }) => {
              const photo = photosBySlot.get(slot);
              return (
                <View key={slot} className="items-center">
                  {photo?.url ? (
                    <Image source={{ uri: photo.url }} className="w-20 h-20 rounded-md" />
                  ) : (
                    <View className="w-20 h-20 rounded-md bg-page-light dark:bg-page-dark items-center justify-center border border-line-subtle">
                      <Ionicons name="image-outline" size={28} color="#003B8E" />
                    </View>
                  )}
                  <Text className="text-caption text-ink-tertiary-light mt-1">{label}</Text>
                  {canEdit && (survey.status === "draft" || survey.status === "rejected") ? (
                    <AppButton
                      label={photo ? "Retake" : "Capture"}
                      size="sm"
                      variant="ghost"
                      onPress={() => capturePhoto(slot)}
                      loading={busy}
                      className="mt-1"
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
          {canEdit && (survey.status === "draft" || survey.status === "rejected") && survey.photos.length === 0 ? (
            <Text className="text-helper text-ink-tertiary-light text-center mt-2">
              Front and side photos are required to submit.
            </Text>
          ) : null}
        </AppCard>

        <SectionLabel>QC remarks ({survey.qcRemarks.length})</SectionLabel>
        <AppCard padded className="mb-4">
          {survey.qcRemarks.length === 0 ? (
            <Text className="text-helper text-ink-tertiary-light text-center py-2">No remarks yet</Text>
          ) : (
            survey.qcRemarks.slice(0, 5).map((r) => (
              <View key={r._id} className="mb-3 last:mb-0">
                <View className="flex-row items-center gap-1.5">
                  <Tag label={r.authorRole} tone={r.authorRole === "surveyor" ? "neutral" : "brand"} />
                  <Text className="text-caption text-ink-tertiary-light">{timeAgo(r._creationTime)}</Text>
                </View>
                <Text className="text-body text-ink-primary-light dark:text-ink-primary-dark mt-1">
                  {r.message}
                </Text>
              </View>
            ))
          )}
        </AppCard>

        {canSubmit ? (
          <AppButton
            label={busy ? "Submitting…" : "Submit for review"}
            loading={busy}
            onPress={doSubmit}
            iconLeft="cloud-upload-outline"
            size="lg"
            fullWidth
            className="mb-2"
          />
        ) : null}

        {canReview ? (
          <View className="flex-row gap-2">
            <AppButton
              label="Reject"
              variant="outline"
              size="lg"
              iconLeft="close-outline"
              onPress={() => doDecide("reject")}
              loading={busy}
              className="flex-1"
            />
            <AppButton
              label="Approve"
              size="lg"
              iconLeft="checkmark-outline"
              onPress={() => doDecide("approve")}
              loading={busy}
              className="flex-1"
            />
          </View>
        ) : null}
      </ScrollView>

      {toast ? <Toast visible title={toast.title} tone={toast.tone} onHide={() => setToast(null)} /> : null}
    </View>
  );
}
