import type { Id } from "@/convex/_generated/dataModel";

/** POST image bytes from a local URI to a Convex storage upload URL. */
export async function uploadImageFromUri(
  uploadUrl: string,
  uri: string,
): Promise<{ storageId: Id<"_storage">; sizeKb: number }> {
  const file = await fetch(uri);
  const blob = await file.blob();
  const sizeKb = Math.max(1, Math.ceil(blob.size / 1024));
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (!result.ok) {
    throw new Error("Photo upload failed");
  }
  const json = (await result.json()) as { storageId: Id<"_storage"> };
  return { storageId: json.storageId, sizeKb };
}
