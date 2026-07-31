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

/**
 * Outcome of the automated payment-proof reading. Stored as plain text in
 * Postgres — narrowed here because every consumer switches on it.
 * See src/lib/payments/proof-check.ts.
 */
export type ProofVerdict = "pass" | "suspect" | "fail" | "error" | "unchecked";

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
      creator_dna: {
        Row: {
          user_id: string;
          niche: string | null;
          target_audience: string | null;
          tone: string | null;
          platforms: string[] | null;
          output_language: string;
          banned_words: string[] | null;
          brand_notes: string | null;
          ai_persona_summary: string | null;
          updated_at: string;
          // Added by migration `creator_dna_depth`. Verified present in
          // information_schema before being written here — this file is
          // generated, and hand-editing it to describe columns that do not
          // exist produces a build that type-checks and then fails at runtime.
          work_context: string;
          client_brief: string | null;
          industry: string | null;
          goals: string | null;
          persona_style: string | null;
          experience_level: string | null;
          content_pillars: string[] | null;
          posting_frequency: string | null;
          reference_creators: string | null;
          humor_level: number | null;
        };
        Insert: {
          user_id: string;
          work_context?: string;
          client_brief?: string | null;
          industry?: string | null;
          goals?: string | null;
          persona_style?: string | null;
          experience_level?: string | null;
          content_pillars?: string[] | null;
          posting_frequency?: string | null;
          reference_creators?: string | null;
          humor_level?: number | null;
          niche?: string | null;
          target_audience?: string | null;
          tone?: string | null;
          platforms?: string[] | null;
          output_language?: string;
          banned_words?: string[] | null;
          brand_notes?: string | null;
          ai_persona_summary?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          niche?: string | null;
          target_audience?: string | null;
          tone?: string | null;
          platforms?: string[] | null;
          output_language?: string;
          banned_words?: string[] | null;
          brand_notes?: string | null;
          ai_persona_summary?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_dna_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      generations: {
        Row: {
          id: string;
          user_id: string;
          module: "ide_hari_ini" | "idea" | "hook" | "script" | "repurpose" | "vibe_kit";
          platform: "tiktok" | "instagram" | "youtube" | "x" | "threads" | null;
          input: Json | null;
          output: Json | null;
          model_used: string | null;
          credits_spent: number;
          is_favorite: boolean;
          performance_rating: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          module: "ide_hari_ini" | "idea" | "hook" | "script" | "repurpose" | "vibe_kit";
          platform?: "tiktok" | "instagram" | "youtube" | "x" | "threads" | null;
          input?: Json | null;
          output?: Json | null;
          model_used?: string | null;
          credits_spent: number;
          is_favorite?: boolean;
          performance_rating?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          module?: "ide_hari_ini" | "idea" | "hook" | "script" | "repurpose" | "vibe_kit";
          platform?: "tiktok" | "instagram" | "youtube" | "x" | "threads" | null;
          input?: Json | null;
          output?: Json | null;
          model_used?: string | null;
          credits_spent?: number;
          is_favorite?: boolean;
          performance_rating?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_cards: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: Json | null;
          status: "ide" | "draft" | "siap" | "posted";
          generation_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content?: Json | null;
          status?: "ide" | "draft" | "siap" | "posted";
          generation_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: Json | null;
          status?: "ide" | "draft" | "siap" | "posted";
          generation_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_cards_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "generations";
            referencedColumns: ["id"];
          }
        ];
      };
      credit_packs: {
        Row: {
          id: string;
          credits: number;
          price_idr: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          credits: number;
          price_idr: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          credits?: number;
          price_idr?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      topups: {
        Row: {
          id: string;
          user_id: string;
          amount_idr: number;
          credits: number;
          method: "bank_transfer" | "qris" | "voucher" | "manual_admin";
          proof_url: string | null;
          proof_path: string | null;
          proof_hash: string | null;
          check_verdict: ProofVerdict;
          check_detail: Json | null;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_idr: number;
          credits: number;
          method: "bank_transfer" | "qris" | "voucher" | "manual_admin";
          proof_url?: string | null;
          proof_path?: string | null;
          proof_hash?: string | null;
          check_verdict?: ProofVerdict;
          check_detail?: Json | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount_idr?: number;
          credits?: number;
          method?: "bank_transfer" | "qris" | "voucher" | "manual_admin";
          proof_url?: string | null;
          proof_path?: string | null;
          proof_hash?: string | null;
          check_verdict?: ProofVerdict;
          check_detail?: Json | null;
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topups_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topups_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      vouchers: {
        Row: {
          code: string;
          credits: number;
          is_redeemed: boolean;
          redeemed_by: string | null;
          redeemed_at: string | null;
          created_by: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          credits: number;
          is_redeemed?: boolean;
          redeemed_by?: string | null;
          redeemed_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          code?: string;
          credits?: number;
          is_redeemed?: boolean;
          redeemed_by?: string | null;
          redeemed_at?: string | null;
          created_by?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vouchers_redeemed_by_fkey";
            columns: ["redeemed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vouchers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string;
          status: "pending" | "credited" | "voided";
          void_reason: string | null;
          credited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referee_id: string;
          status?: "pending" | "credited" | "voided";
          void_reason?: string | null;
          credited_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referee_id?: string;
          status?: "pending" | "credited" | "voided";
          void_reason?: string | null;
          credited_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey";
            columns: ["referrer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referee_id_fkey";
            columns: ["referee_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      trends: {
        Row: {
          id: string;
          source: string;
          title: string;
          summary: string | null;
          category: string | null;
          region: string | null;
          is_active: boolean;
          captured_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          title: string;
          summary?: string | null;
          category?: string | null;
          region?: string | null;
          is_active?: boolean;
          captured_at?: string;
        };
        Update: {
          id?: string;
          source?: string;
          title?: string;
          summary?: string | null;
          category?: string | null;
          region?: string | null;
          is_active?: boolean;
          captured_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          user_id: string;
          window_start: string;
          request_count: number;
        };
        Insert: {
          user_id: string;
          window_start: string;
          request_count?: number;
        };
        Update: {
          user_id?: string;
          window_start?: string;
          request_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      // Added by migration `app_config`. Verified present before being written
      // here — see the note on creator_dna above.
      // Added by migration `error_log_and_user_activity`. Verified present in
      // information_schema before being written here.
      error_log: {
        Row: {
          id: number;
          scope: string;
          module: string | null;
          key_index: number | null;
          model: string | null;
          status: number | null;
          message: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          scope: string;
          message: string;
          module?: string | null;
          key_index?: number | null;
          model?: string | null;
          status?: number | null;
          user_id?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      app_config: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          actor_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      vibe_projects: {
        Row: {
          id: string;
          user_id: string;
          generation_id: string | null;
          name: string;
          one_liner: string | null;
          stack: string | null;
          docs: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          generation_id?: string | null;
          name: string;
          one_liner?: string | null;
          stack?: string | null;
          docs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          generation_id?: string | null;
          name?: string;
          one_liner?: string | null;
          stack?: string | null;
          docs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vibe_projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      /**
       * Admin panel only. One row per user with generation count, credits
       * spent, which modules they used and when they were last active.
       * Added by migration `error_log_and_user_activity`.
       */
      admin_user_activity: {
        Args: { p_days?: number };
        Returns: {
          user_id: string;
          email: string;
          display_name: string | null;
          role: string;
          is_pro: boolean;
          is_banned: boolean;
          credits_total: number;
          generations: number;
          credits_spent: number;
          modules_used: string[] | null;
          last_active: string | null;
          joined: string;
        }[];
      };
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
      /** service_role only. Exact ledger-driven reversal of a spend, by ref. Idempotent. */
      refund_credits: {
        Args: { p_user: string; p_ref: string; p_reason?: string };
        Returns: number;
      };
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

export type CreatorDna = Database["public"]["Tables"]["creator_dna"]["Row"];
export type Generation = Database["public"]["Tables"]["generations"]["Row"];
export type PipelineCard = Database["public"]["Tables"]["pipeline_cards"]["Row"];
export type CreditPack = Database["public"]["Tables"]["credit_packs"]["Row"];
export type Topup = Database["public"]["Tables"]["topups"]["Row"];
export type Voucher = Database["public"]["Tables"]["vouchers"]["Row"];
export type Referral = Database["public"]["Tables"]["referrals"]["Row"];
export type Trend = Database["public"]["Tables"]["trends"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];
