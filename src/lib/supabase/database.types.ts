/**
 * Generated from the live schema. Do not hand-edit.
 *
 * Regenerate after every migration — a stale copy of this file is worse than no
 * types at all, because it type-checks against a database that no longer exists.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null;
          ban_reason: string | null;
          created_at: string;
          credits_free: number;
          credits_paid: number;
          display_name: string | null;
          email: string;
          fingerprint_hash: string | null;
          free_trial_used: boolean;
          id: string;
          is_banned: boolean;
          is_pro: boolean;
          last_refill_date: string;
          onboarding_completed: boolean;
          referral_code: string;
          referred_by: string | null;
          role: string;
          signup_ip_hash: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          ban_reason?: string | null;
          created_at?: string;
          credits_free?: number;
          credits_paid?: number;
          display_name?: string | null;
          email: string;
          fingerprint_hash?: string | null;
          free_trial_used?: boolean;
          id: string;
          is_banned?: boolean;
          is_pro?: boolean;
          last_refill_date?: string;
          onboarding_completed?: boolean;
          referral_code: string;
          referred_by?: string | null;
          role?: string;
          signup_ip_hash?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          ban_reason?: string | null;
          created_at?: string;
          credits_free?: number;
          credits_paid?: number;
          display_name?: string | null;
          email?: string;
          fingerprint_hash?: string | null;
          free_trial_used?: boolean;
          id?: string;
          is_banned?: boolean;
          is_pro?: boolean;
          last_refill_date?: string;
          onboarding_completed?: boolean;
          referral_code?: string;
          referred_by?: string | null;
          role?: string;
          signup_ip_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey";
            columns: ["referred_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      gen_referral_code: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/** Convenience alias — the shape of a profiles row. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
