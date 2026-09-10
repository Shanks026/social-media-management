// Job role colors reuse the note-tag palette rather than defining a second one.
//
// Both features are "workspace-scoped colored labels", and a single palette
// means one set of static Tailwind class strings for the JIT compiler to find.
// See src/lib/noteTags.js for why the class names must never be built
// dynamically.
export {
  TAG_COLORS as JOB_ROLE_COLORS,
  TAG_COLOR_KEYS as JOB_ROLE_COLOR_KEYS,
  getTagColor as getJobRoleColor,
  nextTagColor as nextJobRoleColor,
} from '@/lib/noteTags'
