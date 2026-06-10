import { supabase } from "@/lib/supabase";
import { resolveWorkspace } from "@/lib/workspace";

export async function uploadPostImage({ file, clientId }) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${clientId}/${fileName}`;

    const { error } = await supabase.storage
        .from("post-media")
        .upload(filePath, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
        .from("post-media")
        .getPublicUrl(filePath);

    // Track storage usage — non-fatal if this fails
    try {
        const { workspaceUserId } = await resolveWorkspace()
        await supabase.rpc('increment_storage_used', {
            p_user_id: workspaceUserId,
            p_bytes: file.size,
        })
    } catch {
        // don't fail the upload if tracking fails
    }

    return data.publicUrl;
}
