/**
 * Survey wizard (single-form variant).
 *
 * On submit, posts to `surveys.upsert` with a stable `localId` so retries
 * (network drops, app restarts) reconcile to the same row server-side.
 * Once the upsert returns, we route to the survey detail screen.
 *
 * The full 8-step wizard from the prior UI build can be dropped in by
 * splitting these field groups into separate screens — the upsert
 * contract stays identical.
 */
import {
  AppButton,
  AppCard,
  AppDropdown,
  AppInput,
  Banner,
  RadioGroup,
  SectionLabel,
  Spinner,
  Toast,
} from "@/components";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toUserMessage } from "@/utils/errors";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Stable per-device id for offline draft idempotency.
function newLocalId(): string {
  return `ls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface Form {
  localId: string;
  municipalityId?: Id<"municipalities">;
  wardNo: string;
  propertyNo: string;
  isSlum: boolean;
  ownerName: string;
  respondentName: string;
  relationship: string;
  mobileNo: string;
  familySize: string;
  houseNo: string;
  street: string;
  locality: string;
  city: string;
  pinCode: string;
  assessmentYear: string;
  ownershipType: string;
  propertyType: string;
  propertyUse: string;
  situation: string;
  roadType: string;
  taxRateZone: string;
  plotSqft: string;
  plinthSqft: string;
  waterSource: string;
  sanitationType: string;
  solidWasteType: string;
  electricityNo: string;
}

function emptyForm(): Form {
  return {
    localId: newLocalId(),
    wardNo: "",
    propertyNo: "",
    isSlum: false,
    ownerName: "",
    respondentName: "",
    relationship: "",
    mobileNo: "",
    familySize: "1",
    houseNo: "",
    street: "",
    locality: "",
    city: "",
    pinCode: "",
    assessmentYear: "",
    ownershipType: "",
    propertyType: "",
    propertyUse: "",
    situation: "",
    roadType: "",
    taxRateZone: "",
    plotSqft: "",
    plinthSqft: "",
    waterSource: "",
    sanitationType: "",
    solidWasteType: "",
    electricityNo: "",
  };
}

function surveyToForm(s: {
  localId: string;
  municipalityId: Id<"municipalities">;
  wardNo: string;
  propertyNo: string;
  isSlum: boolean;
  ownerName: string;
  respondentName: string;
  relationship: string;
  mobileNo: string;
  familySize: number;
  houseNo: string;
  street: string;
  locality?: string;
  city: string;
  pinCode: string;
  assessmentYear: string;
  ownershipType: string;
  propertyType: string;
  propertyUse: string;
  situation: string;
  roadType: string;
  taxRateZone: string;
  plotSqft: number;
  plinthSqft: number;
  waterSource: string;
  sanitationType: string;
  solidWasteType: string;
  electricityNo?: string;
}): Form {
  return {
    localId: s.localId,
    municipalityId: s.municipalityId,
    wardNo: s.wardNo,
    propertyNo: s.propertyNo,
    isSlum: s.isSlum,
    ownerName: s.ownerName,
    respondentName: s.respondentName,
    relationship: s.relationship,
    mobileNo: s.mobileNo,
    familySize: String(s.familySize),
    houseNo: s.houseNo,
    street: s.street,
    locality: s.locality ?? "",
    city: s.city,
    pinCode: s.pinCode,
    assessmentYear: s.assessmentYear,
    ownershipType: s.ownershipType,
    propertyType: s.propertyType,
    propertyUse: s.propertyUse,
    situation: s.situation,
    roadType: s.roadType,
    taxRateZone: s.taxRateZone,
    plotSqft: String(s.plotSqft),
    plinthSqft: String(s.plinthSqft),
    waterSource: s.waterSource,
    sanitationType: s.sanitationType,
    solidWasteType: s.solidWasteType,
    electricityNo: s.electricityNo ?? "",
  };
}

export default function WizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id as Id<"surveys"> | undefined;
  const me = useQuery(api.users.currentUser, {});
  const masters = useQuery(api.masters.bundle, {});
  const existing = useQuery(api.surveys.get, editId ? { id: editId } : "skip");
  const upsert = useMutation(api.surveys.upsert);

  const [form, setForm] = useState<Form>(() => emptyForm());
  const hydrated = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; tone: "success" | "danger" } | null>(null);

  useEffect(() => {
    if (!editId || !existing || hydrated.current) return;
    hydrated.current = true;
    setForm(surveyToForm(existing));
  }, [editId, existing]);

  const setField = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Resolve user's default municipality on first masters load
  const defaultMuni = useMemo(() => {
    if (!masters || !me?.municipalityId) return undefined;
    return masters.ulbs.find((u) => u._id === me.municipalityId);
  }, [masters, me]);

  const muniOptions = useMemo(
    () => masters?.ulbs.map((u) => ({ value: u._id, label: u.name })) ?? [],
    [masters],
  );

  const wardOptions = useMemo(() => {
    if (!masters) return [];
    const muniId = form.municipalityId ?? defaultMuni?._id;
    if (!muniId) return [];
    const muniCode = masters.ulbs.find((u) => u._id === muniId)?.code;
    return masters.wards
      .filter((w) => w.municipalityCode === muniCode)
      .map((w) => ({ value: w.wardNo, label: `Ward ${w.wardNo} · ${w.name}` }));
  }, [masters, form.municipalityId, defaultMuni]);

  if (me === undefined || masters === undefined || (editId && existing === undefined)) {
    return <Spinner label="Loading…" />;
  }
  if (editId && existing === null) {
    return (
      <View className="flex-1 items-center justify-center bg-page-light p-6">
        <Text className="text-h2 text-ink-primary-light">Survey not found</Text>
      </View>
    );
  }

  const onSubmit = async () => {
    const muniId = form.municipalityId ?? defaultMuni?._id;
    if (!muniId) {
      setToast({ title: "Select a municipality", tone: "danger" });
      return;
    }
    setSubmitting(true);
    try {
      const savedId = await upsert({
        localId: form.localId,
        municipalityId: muniId,
        wardNo: form.wardNo,
        propertyNo: form.propertyNo.trim(),
        isSlum: form.isSlum,
        ownerName: form.ownerName.trim(),
        respondentName: form.respondentName.trim(),
        relationship: form.relationship,
        mobileNo: form.mobileNo.trim(),
        familySize: Math.max(1, parseInt(form.familySize, 10) || 1),
        houseNo: form.houseNo.trim(),
        street: form.street.trim(),
        locality: form.locality.trim() || undefined,
        city: form.city.trim(),
        pinCode: form.pinCode.trim(),
        assessmentYear: form.assessmentYear,
        ownershipType: form.ownershipType,
        propertyType: form.propertyType,
        propertyUse: form.propertyUse,
        situation: form.situation,
        roadType: form.roadType,
        taxRateZone: form.taxRateZone,
        plotSqft: parseFloat(form.plotSqft) || 0,
        plinthSqft: parseFloat(form.plinthSqft) || 0,
        waterSource: form.waterSource,
        sanitationType: form.sanitationType,
        solidWasteType: form.solidWasteType,
        electricityNo: form.electricityNo.trim() || undefined,
        clientUpdatedAt: Date.now(),
      });
      setToast({ title: editId ? "Survey updated" : "Draft saved", tone: "success" });
      const targetId = editId ?? savedId;
      setTimeout(() => router.replace({ pathname: "/(app)/survey/[id]", params: { id: targetId } }), 600);
    } catch (e) {
      setToast({ title: toUserMessage(e), tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-page-light dark:bg-page-dark">
      <SafeAreaView edges={["top"]} className="bg-brand">
        <View className="px-4 py-3 flex-row items-center">
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" onPress={() => router.back()} />
          <Text className="text-h3 font-medium text-white ml-2">
            {editId ? "Edit survey" : "New survey"}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <Banner
          tone="info"
          title="Quick capture form"
          message="All fields below; photos and GPS can be added on the detail screen after this saves."
          icon="information-circle-outline"
          className="mb-4"
        />

        <SectionLabel>Property</SectionLabel>
        <AppCard padded className="mb-3">
          <View className="gap-3">
            <AppDropdown
              placeholder="Municipality"
              value={(form.municipalityId ?? defaultMuni?._id ?? "") as string}
              options={muniOptions}
              onChange={(v) => setField("municipalityId", v as Id<"municipalities">)}
              disabled={muniOptions.length === 1}
            />
            <AppDropdown
              placeholder="Ward"
              value={form.wardNo}
              options={wardOptions}
              onChange={(v) => setField("wardNo", v)}
            />
            <AppInput label="Property no" required value={form.propertyNo} onChangeText={(v) => setField("propertyNo", v)} />
            <RadioGroup
              items={[
                { value: "no", label: "Not a slum property" },
                { value: "yes", label: "Slum property" },
              ]}
              value={form.isSlum ? "yes" : "no"}
              onChange={(v) => setField("isSlum", v === "yes")}
            />
          </View>
        </AppCard>

        <SectionLabel>Owner</SectionLabel>
        <AppCard padded className="mb-3">
          <View className="gap-3">
            <AppInput label="Owner name" required value={form.ownerName} onChangeText={(v) => setField("ownerName", v)} />
            <AppInput label="Respondent name" required value={form.respondentName} onChangeText={(v) => setField("respondentName", v)} />
            <AppDropdown
              placeholder="Relationship"
              value={form.relationship}
              options={masters.relationships}
              onChange={(v) => setField("relationship", v)}
            />
            <AppInput
              label="Mobile (10 digits)"
              required
              keyboardType="number-pad"
              value={form.mobileNo}
              onChangeText={(v) => setField("mobileNo", v.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
            />
            <AppInput
              label="Family size"
              keyboardType="number-pad"
              value={form.familySize}
              onChangeText={(v) => setField("familySize", v.replace(/\D/g, "").slice(0, 3))}
            />
          </View>
        </AppCard>

        <SectionLabel>Address</SectionLabel>
        <AppCard padded className="mb-3">
          <View className="gap-3">
            <AppInput label="House no" required value={form.houseNo} onChangeText={(v) => setField("houseNo", v)} />
            <AppInput label="Street" required value={form.street} onChangeText={(v) => setField("street", v)} />
            <AppInput label="Locality" value={form.locality} onChangeText={(v) => setField("locality", v)} />
            <AppInput label="City" required value={form.city} onChangeText={(v) => setField("city", v)} />
            <AppInput
              label="PIN (6 digits)"
              required
              keyboardType="number-pad"
              maxLength={6}
              value={form.pinCode}
              onChangeText={(v) => setField("pinCode", v.replace(/\D/g, "").slice(0, 6))}
            />
          </View>
        </AppCard>

        <SectionLabel>Taxation</SectionLabel>
        <AppCard padded className="mb-3">
          <View className="gap-3">
            <AppDropdown placeholder="Assessment year" value={form.assessmentYear} options={masters.assessmentYears} onChange={(v) => setField("assessmentYear", v)} />
            <AppDropdown placeholder="Ownership type" value={form.ownershipType} options={masters.ownershipTypes} onChange={(v) => setField("ownershipType", v)} />
            <AppDropdown placeholder="Property type" value={form.propertyType} options={masters.propertyTypes} onChange={(v) => setField("propertyType", v)} />
            <AppDropdown placeholder="Property use" value={form.propertyUse} options={masters.propertyUses} onChange={(v) => setField("propertyUse", v)} />
            <AppDropdown placeholder="Situation" value={form.situation} options={masters.situations} onChange={(v) => setField("situation", v)} />
            <AppDropdown placeholder="Road type" value={form.roadType} options={masters.roadTypes} onChange={(v) => setField("roadType", v)} />
            <AppDropdown placeholder="Tax rate zone" value={form.taxRateZone} options={masters.taxRateZones} onChange={(v) => setField("taxRateZone", v)} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppInput label="Plot (sq ft)" keyboardType="decimal-pad" value={form.plotSqft} onChangeText={(v) => setField("plotSqft", v)} />
              </View>
              <View className="flex-1">
                <AppInput label="Plinth (sq ft)" keyboardType="decimal-pad" value={form.plinthSqft} onChangeText={(v) => setField("plinthSqft", v)} />
              </View>
            </View>
          </View>
        </AppCard>

        <SectionLabel>Services</SectionLabel>
        <AppCard padded className="mb-4">
          <View className="gap-3">
            <AppDropdown placeholder="Water source" value={form.waterSource} options={masters.waterSources} onChange={(v) => setField("waterSource", v)} />
            <AppDropdown placeholder="Sanitation" value={form.sanitationType} options={masters.sanitationTypes} onChange={(v) => setField("sanitationType", v)} />
            <AppDropdown placeholder="Solid waste" value={form.solidWasteType} options={masters.solidWasteTypes} onChange={(v) => setField("solidWasteType", v)} />
            <AppInput label="Electricity no" value={form.electricityNo} onChangeText={(v) => setField("electricityNo", v)} />
          </View>
        </AppCard>

        <AppButton
          label={submitting ? "Saving…" : editId ? "Save changes" : "Save draft"}
          loading={submitting}
          onPress={onSubmit}
          iconLeft="save-outline"
          size="lg"
          fullWidth
        />
      </ScrollView>

      {toast ? <Toast visible title={toast.title} tone={toast.tone} onHide={() => setToast(null)} /> : null}
    </View>
  );
}
