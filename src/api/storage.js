import { supabase } from "@/lib/supabase";

export async function uploadPostImage({
    file,
    clientId,
}) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const filePath = `${clientId}/${fileName}`;

    const { error } = await supabase.storage
        .from("post-media")
        .upload(filePath, file, {
            upsert: false,
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from("post-media")
        .getPublicUrl(filePath);

    return data.publicUrl;
}
