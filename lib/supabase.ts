import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

/** The single shared Supabase client used for auth, database and storage. */
export const supabase = createClient(url || "https://invalid.supabase.co", anonKey || "missing-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const MEDIA_BUCKET = "project-media";
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB per creator
