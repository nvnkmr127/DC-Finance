import { getSupabase } from "@/lib/supabase/client";

const BUCKET = "receipts";

// Upload a receipt file and return its storage path (stored on the row).
export async function uploadReceipt(file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

// Short-lived signed URL for viewing/downloading a private receipt.
export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 5); // 5 minutes
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteReceipt(path: string): Promise<void> {
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
