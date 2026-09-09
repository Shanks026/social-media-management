-- 1. Sync existing storage usage
UPDATE public.agency_subscriptions sub
SET current_storage_used = COALESCE((
    SELECT SUM((metadata->>'size')::bigint)
    FROM storage.objects obj
    WHERE obj.owner = sub.user_id
), 0);

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.update_storage_usage()
RETURNS TRIGGER AS $$
DECLARE
    obj_owner uuid;
    obj_size bigint;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        obj_owner := NEW.owner;
        obj_size := (NEW.metadata->>'size')::bigint;
        
        IF obj_owner IS NOT NULL THEN
            UPDATE public.agency_subscriptions
            SET current_storage_used = current_storage_used + COALESCE(obj_size, 0)
            WHERE user_id = obj_owner;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        obj_owner := OLD.owner;
        obj_size := (OLD.metadata->>'size')::bigint;
        
        IF obj_owner IS NOT NULL THEN
            UPDATE public.agency_subscriptions
            SET current_storage_used = GREATEST(0, current_storage_used - COALESCE(obj_size, 0))
            WHERE user_id = obj_owner;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle size changes (rare for objects but good for robustness)
        obj_owner := NEW.owner;
        IF obj_owner IS NOT NULL THEN
            UPDATE public.agency_subscriptions
            SET current_storage_used = current_storage_used 
                + COALESCE((NEW.metadata->>'size')::bigint, 0) 
                - COALESCE((OLD.metadata->>'size')::bigint, 0)
            WHERE user_id = obj_owner;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to storage.objects
DROP TRIGGER IF EXISTS on_storage_object_changed ON storage.objects;
CREATE TRIGGER on_storage_object_changed
AFTER INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.update_storage_usage();;
