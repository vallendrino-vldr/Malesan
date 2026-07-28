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
      credit_ledger: {
        Row: {
          balance_after: number;
          bucket: string;
          created_at: string;
          delta: number;
          id: number;
          reason: string;
          ref_id: string | null;
          user_id: string;
        };
        Insert: {
          balance_after: number;
          bucket: string;
          created_at?: string;
          delta: number;
          id?: number;
          reason: string;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          balance_after?: number;
          bucket?: string;
          created_at?: string;
          delta?: number;
          id?: number;
          reason?: string;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gemini_usage: {
        Row: {
          usage_date: string;
          key_index: number;
          model: string;
          request_count: number;
          error_count: number;
          token_count: number;
          updated_at: string;
        };
        Insert: {
          usage_date?: string;
          key_index: number;
          model: string;
          request_count?: number;
          error_count?: number;
          token_count?: number;
          updated_at?: string;
        };
        Update: {
          usage_date?: string;
          key_index?: number;
          model?: string;
          request_count?: number;
          error_count?: number;
          token_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_api_keys: {
        Row: {
          user_id: string;
          provider: string;
          key_encrypted: string;
          is_active: boolean;
          last_verified_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          provider?: string;
          key_encrypted: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          provider?: string;
          key_encrypted?: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_api_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      /** service_role only. Upserts one Gemini call into gemini_usage. */
      record_gemini_usage: {
        Args: {
          p_key_index: number;
          p_model: string;
          p_tokens?: number;
          p_is_error?: boolean;
        };
        Returns: undefined;
      };
      /** service_role only. Today's request and error counts per key. */
      gemini_pool_used_today: {
        Args: never;
        Returns: { key_index: number; requests: number; errors: number }[];
      };
      gen_referral_code: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      /** service_role only. Throws INSUFFICIENT_CREDITS. Returns the new total balance. */
      spend_credits: {
        Args: {
          p_user: string;
          p_amount: number;
          p_reason: string;
          p_ref?: string | null;
        };
        Returns: number;
      };
      /** service_role only. Sets credits_free to 10; does not add. Idempotent per day. */
      claim_daily_refill: { Args: { p_user: string }; Returns: number };
      /** service_role only. Admin/system grants. */
      grant_credits: {
        Args: {
          p_user: string;
          p_amount: number;
          p_bucket: "free" | "paid";
          p_reason: string;
          p_ref?: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

/** Convenience alias — the shape of a profiles row. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
