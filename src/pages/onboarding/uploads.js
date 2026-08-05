import { supabase } from '@/lib/supabase'

const BUCKET = 'post-media'

/**
 * Extracts the storage path from a post-media public URL so the file can be
 * removed. Mirrors the helper duplicated in CreateClientPage / AgencySettings /
 * InvoiceSettings.
 */
export function extractStoragePath(publicUrl) {
  if (!publicUrl) return null
  const marker = `/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  return idx !== -1 ? publicUrl.slice(idx + marker.length) : null
}

/**
 * Uploads a File or Blob under the given prefix and returns its public URL.
 * `prefix` is 'branding' for logos and 'signatures' for the invoice signature,
 * matching the paths AgencySettings and InvoiceSettings already write to.
 */
export async function uploadBrandingAsset(fileOrBlob, prefix, ext) {
  const resolvedExt =
    ext || (fileOrBlob.name ? fileOrBlob.name.split('.').pop() : 'png')
  const filePath = `${prefix}/${Date.now()}.${resolvedExt}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, fileOrBlob, {
      contentType: fileOrBlob.type || undefined,
    })
  if (error) throw error

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(filePath)

  return publicUrl
}

/**
 * Best-effort removal of a superseded asset. Never throws — losing an orphaned
 * file is not worth failing a form submit over.
 */
export async function removeBrandingAsset(publicUrl) {
  const path = extractStoragePath(publicUrl)
  if (!path) return
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    /* orphaned file; not worth surfacing */
  }
}
