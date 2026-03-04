import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
export const remoteModeEnabled = hasSupabaseConfig;

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseKey as string)
  : null;

export const checkSupabaseConnection = async (): Promise<{ ok: boolean; message: string }> => {
  if (!supabase) {
    return {
      ok: false,
      message: "Falta configuración de Supabase (URL o key)."
    };
  }

  try {
    const { error } = await supabase.from("app_state").select("id", { head: true, count: "exact" });
    if (error) {
      return { ok: false, message: `Supabase respondió con error: ${error.message}` };
    }
    return { ok: true, message: "Conexión con Supabase OK." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return { ok: false, message: `No se pudo conectar con Supabase: ${message}` };
  }
};
