import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "host.docker.internal"])

// `npm run dev` must only ever reach the local Supabase stack (#91, ADR 0005).
// Production from a dev server is the deliberate `npm run dev:prod`
// (`--mode production`), which skips this check.
function assertLocalSupabase(mode) {
  const env = loadEnv(mode, __dirname, "VITE_")
  let host = ""
  try {
    host = new URL(env.VITE_SUPABASE_URL).hostname
  } catch {
    // missing or malformed: fall through to the error below
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      [
        `npm run dev is pointed at ${env.VITE_SUPABASE_URL || "no Supabase URL"}, not the local stack.`,
        "  Local:      npx supabase start && npm run env:local && npm run dev",
        "  Production: npm run dev:prod   (deliberate opt-in)",
      ].join("\n"),
    )
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "serve" && mode === "development") assertLocalSupabase(mode)
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
