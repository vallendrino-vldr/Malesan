export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          capabilities: string[]
          context_length: number | null
          created_at: string
          discovered_at: string | null
          id: string
          input_price_usd_per_mtok: number
          is_active: boolean
          label: string | null
          model_id: string
          output_price_usd_per_mtok: number
          package_expires_at: string | null
          package_price_idr: number | null
          package_tokens: number | null
          pricing_mode: string
          provider_id: string
          source: string
          supports_schema: boolean
          supports_streaming: boolean
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          context_length?: number | null
          created_at?: string
          discovered_at?: string | null
          id?: string
          input_price_usd_per_mtok?: number
          is_active?: boolean
          label?: string | null
          model_id: string
          output_price_usd_per_mtok?: number
          package_expires_at?: string | null
          package_price_idr?: number | null
          package_tokens?: number | null
          pricing_mode?: string
          provider_id: string
          source?: string
          supports_schema?: boolean
          supports_streaming?: boolean
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          context_length?: number | null
          created_at?: string
          discovered_at?: string | null
          id?: string
          input_price_usd_per_mtok?: number
          is_active?: boolean
          label?: string | null
          model_id?: string
          output_price_usd_per_mtok?: number
          package_expires_at?: string | null
          package_price_idr?: number | null
          package_tokens?: number | null
          pricing_mode?: string
          provider_id?: string
          source?: string
          supports_schema?: boolean
          supports_streaming?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_balance: {
        Row: {
          amount: number | null
          checked_at: string
          currency: string | null
          id: number
          provider_id: string
          raw: Json | null
          remaining_tokens: number | null
          total_tokens: number | null
          used_tokens: number | null
        }
        Insert: {
          amount?: number | null
          checked_at?: string
          currency?: string | null
          id?: number
          provider_id: string
          raw?: Json | null
          remaining_tokens?: number | null
          total_tokens?: number | null
          used_tokens?: number | null
        }
        Update: {
          amount?: number | null
          checked_at?: string
          currency?: string | null
          id?: number
          provider_id?: string
          raw?: Json | null
          remaining_tokens?: number | null
          total_tokens?: number | null
          used_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_balance_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key_encrypted: string | null
          balance_currency: string
          balance_kind: string
          balance_path: string | null
          balance_url: string | null
          base_url: string | null
          consecutive_failures: number
          created_at: string
          id: string
          is_active: boolean
          key_source: string
          label: string
          last_checked_at: string | null
          last_error: string | null
          last_latency_ms: number | null
          last_ok_at: string | null
          low_balance_threshold: number | null
          notes: string | null
          priority: number
          protocol: string
          slug: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          balance_currency?: string
          balance_kind?: string
          balance_path?: string | null
          balance_url?: string | null
          base_url?: string | null
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean
          key_source?: string
          label: string
          last_checked_at?: string | null
          last_error?: string | null
          last_latency_ms?: number | null
          last_ok_at?: string | null
          low_balance_threshold?: number | null
          notes?: string | null
          priority?: number
          protocol?: string
          slug: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          balance_currency?: string
          balance_kind?: string
          balance_path?: string | null
          balance_url?: string | null
          base_url?: string | null
          consecutive_failures?: number
          created_at?: string
          id?: string
          is_active?: boolean
          key_source?: string
          label?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_latency_ms?: number | null
          last_ok_at?: string | null
          low_balance_threshold?: number | null
          notes?: string | null
          priority?: number
          protocol?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_routes: {
        Row: {
          fallback_model_ids: string[]
          feature: string
          is_active: boolean
          label: string | null
          mode: string
          notes: string | null
          prefer: string
          primary_model_id: string | null
          required_capabilities: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fallback_model_ids?: string[]
          feature: string
          is_active?: boolean
          label?: string | null
          mode?: string
          notes?: string | null
          prefer?: string
          primary_model_id?: string | null
          required_capabilities?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fallback_model_ids?: string[]
          feature?: string
          is_active?: boolean
          label?: string | null
          mode?: string
          notes?: string | null
          prefer?: string
          primary_model_id?: string | null
          required_capabilities?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_routes_primary_model_id_fkey"
            columns: ["primary_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_routes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          attempt: number
          cost_idr: number
          created_at: string
          credits_charged: number
          error_message: string | null
          feature: string
          id: number
          input_tokens: number
          latency_ms: number | null
          model_id: string | null
          output_tokens: number
          provider_id: string | null
          provider_slug: string | null
          ref_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          attempt?: number
          cost_idr?: number
          created_at?: string
          credits_charged?: number
          error_message?: string | null
          feature: string
          id?: number
          input_tokens?: number
          latency_ms?: number | null
          model_id?: string | null
          output_tokens?: number
          provider_id?: string | null
          provider_slug?: string | null
          ref_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          attempt?: number
          cost_idr?: number
          created_at?: string
          credits_charged?: number
          error_message?: string | null
          feature?: string
          id?: number
          input_tokens?: number
          latency_ms?: number | null
          model_id?: string | null
          output_tokens?: number
          provider_id?: string | null
          provider_slug?: string | null
          ref_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_clip_jobs: {
        Row: {
          bridge_claimed_at: string | null
          bridge_token_expires_at: string | null
          bridge_token_hash: string | null
          bridge_token_used_at: string | null
          caption_preset: string
          clip_title: string
          created_at: string
          credit_amount: number
          credit_ref: string | null
          end_time: number
          error_code: string | null
          error_message: string | null
          focus: string
          id: string
          language: string
          output_bytes: number | null
          output_name: string | null
          progress: number
          ratio: string
          source_url: string
          stage: string | null
          start_time: number
          status: string
          title: string
          updated_at: string
          user_id: string
          video_id: string
          worker_token_expires_at: string | null
          worker_token_hash: string | null
        }
        Insert: {
          bridge_claimed_at?: string | null
          bridge_token_expires_at?: string | null
          bridge_token_hash?: string | null
          bridge_token_used_at?: string | null
          caption_preset?: string
          clip_title: string
          created_at?: string
          credit_amount: number
          credit_ref?: string | null
          end_time: number
          error_code?: string | null
          error_message?: string | null
          focus?: string
          id?: string
          language?: string
          output_bytes?: number | null
          output_name?: string | null
          progress?: number
          ratio?: string
          source_url: string
          stage?: string | null
          start_time: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
          video_id: string
          worker_token_expires_at?: string | null
          worker_token_hash?: string | null
        }
        Update: {
          bridge_claimed_at?: string | null
          bridge_token_expires_at?: string | null
          bridge_token_hash?: string | null
          bridge_token_used_at?: string | null
          caption_preset?: string
          clip_title?: string
          created_at?: string
          credit_amount?: number
          credit_ref?: string | null
          end_time?: number
          error_code?: string | null
          error_message?: string | null
          focus?: string
          id?: string
          language?: string
          output_bytes?: number | null
          output_name?: string | null
          progress?: number
          ratio?: string
          source_url?: string
          stage?: string | null
          start_time?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_id?: string
          worker_token_expires_at?: string | null
          worker_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_clip_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_dna: {
        Row: {
          ai_persona_summary: string | null
          banned_words: string[] | null
          brand_notes: string | null
          client_brief: string | null
          content_pillars: string[] | null
          cta_enabled: boolean
          cta_label: string | null
          cta_url: string | null
          experience_level: string | null
          goals: string | null
          humor_level: number | null
          industry: string | null
          niche: string | null
          output_language: string
          persona_style: string | null
          platforms: string[] | null
          posting_frequency: string | null
          reference_creators: string | null
          target_audience: string | null
          tone: string | null
          updated_at: string
          user_id: string
          work_context: string
        }
        Insert: {
          ai_persona_summary?: string | null
          banned_words?: string[] | null
          brand_notes?: string | null
          client_brief?: string | null
          content_pillars?: string[] | null
          cta_enabled?: boolean
          cta_label?: string | null
          cta_url?: string | null
          experience_level?: string | null
          goals?: string | null
          humor_level?: number | null
          industry?: string | null
          niche?: string | null
          output_language?: string
          persona_style?: string | null
          platforms?: string[] | null
          posting_frequency?: string | null
          reference_creators?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          work_context?: string
        }
        Update: {
          ai_persona_summary?: string | null
          banned_words?: string[] | null
          brand_notes?: string | null
          client_brief?: string | null
          content_pillars?: string[] | null
          cta_enabled?: boolean
          cta_label?: string | null
          cta_url?: string | null
          experience_level?: string | null
          goals?: string | null
          humor_level?: number | null
          industry?: string | null
          niche?: string | null
          output_language?: string
          persona_style?: string | null
          platforms?: string[] | null
          posting_frequency?: string | null
          reference_creators?: string | null
          target_audience?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          work_context?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_dna_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          balance_after: number
          bucket: string
          created_at: string
          delta: number
          id: number
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          bucket: string
          created_at?: string
          delta: number
          id?: number
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          bucket?: string
          created_at?: string
          delta?: number
          id?: number
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          created_at: string
          credits: number
          id: string
          is_active: boolean
          price_idr: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          is_active?: boolean
          price_idr: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          price_idr?: number
          sort_order?: number
        }
        Relationships: []
      }
      drafts: {
        Row: {
          content: string
          created_at: string
          id: string
          pipeline_card_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          pipeline_card_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pipeline_card_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_pipeline_card_id_fkey"
            columns: ["pipeline_card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      error_log: {
        Row: {
          created_at: string
          id: number
          key_index: number | null
          message: string
          model: string | null
          module: string | null
          scope: string
          status: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          key_index?: number | null
          message: string
          model?: string | null
          module?: string | null
          scope: string
          status?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          key_index?: number | null
          message?: string
          model?: string | null
          module?: string | null
          scope?: string
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      gemini_usage: {
        Row: {
          error_count: number
          input_tokens: number
          key_index: number
          model: string
          output_tokens: number
          request_count: number
          token_count: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          error_count?: number
          input_tokens?: number
          key_index: number
          model: string
          output_tokens?: number
          request_count?: number
          token_count?: number
          updated_at?: string
          usage_date?: string
        }
        Update: {
          error_count?: number
          input_tokens?: number
          key_index?: number
          model?: string
          output_tokens?: number
          request_count?: number
          token_count?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string
          credits_spent: number
          id: string
          input: Json | null
          is_favorite: boolean
          model_used: string | null
          module: string
          output: Json | null
          performance_rating: number | null
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_spent: number
          id?: string
          input?: Json | null
          is_favorite?: boolean
          model_used?: string | null
          module: string
          output?: Json | null
          performance_rating?: number | null
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credits_spent?: number
          id?: string
          input?: Json | null
          is_favorite?: boolean
          model_used?: string | null
          module?: string
          output?: Json | null
          performance_rating?: number | null
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
          voice: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
          voice: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          voice?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_cards: {
        Row: {
          ai_score: number | null
          content: Json | null
          created_at: string
          generation_id: string | null
          id: string
          schedule_label: string | null
          schedule_reason: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_score?: number | null
          content?: Json | null
          created_at?: string
          generation_id?: string | null
          id?: string
          schedule_label?: string | null
          schedule_reason?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_score?: number | null
          content?: Json | null
          created_at?: string
          generation_id?: string | null
          id?: string
          schedule_label?: string | null
          schedule_reason?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_cards_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          created_at: string
          credits_free: number
          credits_paid: number
          display_name: string | null
          email: string
          fingerprint_hash: string | null
          free_trial_used: boolean
          id: string
          is_banned: boolean
          is_pro: boolean
          last_refill_date: string
          onboarding_completed: boolean
          referral_code: string
          referred_by: string | null
          role: string
          signup_ip_hash: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string
          credits_free?: number
          credits_paid?: number
          display_name?: string | null
          email: string
          fingerprint_hash?: string | null
          free_trial_used?: boolean
          id: string
          is_banned?: boolean
          is_pro?: boolean
          last_refill_date?: string
          onboarding_completed?: boolean
          referral_code: string
          referred_by?: string | null
          role?: string
          signup_ip_hash?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string
          credits_free?: number
          credits_paid?: number
          display_name?: string | null
          email?: string
          fingerprint_hash?: string | null
          free_trial_used?: boolean
          id?: string
          is_banned?: boolean
          is_pro?: boolean
          last_refill_date?: string
          onboarding_completed?: boolean
          referral_code?: string
          referred_by?: string | null
          role?: string
          signup_ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          request_count: number
          scope: string
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          scope?: string
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          scope?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          referee_id: string
          referrer_id: string
          status: string
          void_reason: string | null
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referee_id: string
          referrer_id: string
          status?: string
          void_reason?: string | null
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referee_id?: string
          referrer_id?: string
          status?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topups: {
        Row: {
          amount_idr: number
          check_detail: Json | null
          check_verdict: string
          created_at: string
          credits: number
          id: string
          method: string
          note: string | null
          proof_hash: string | null
          proof_path: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_idr: number
          check_detail?: Json | null
          check_verdict?: string
          created_at?: string
          credits: number
          id?: string
          method: string
          note?: string | null
          proof_hash?: string | null
          proof_path?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_idr?: number
          check_detail?: Json | null
          check_verdict?: string
          created_at?: string
          credits?: number
          id?: string
          method?: string
          note?: string | null
          proof_hash?: string | null
          proof_path?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topups_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          captured_at: string
          category: string | null
          content_angle: string | null
          id: string
          is_active: boolean
          region: string | null
          source: string
          summary: string | null
          title: string
        }
        Insert: {
          captured_at?: string
          category?: string | null
          content_angle?: string | null
          id?: string
          is_active?: boolean
          region?: string | null
          source: string
          summary?: string | null
          title: string
        }
        Update: {
          captured_at?: string
          category?: string | null
          content_angle?: string | null
          id?: string
          is_active?: boolean
          region?: string | null
          source?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          is_active: boolean
          key_encrypted: string
          last_verified_at: string | null
          provider: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          key_encrypted: string
          last_verified_at?: string | null
          provider?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          key_encrypted?: string
          last_verified_at?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_projects: {
        Row: {
          created_at: string
          docs: Json
          generation_id: string | null
          id: string
          name: string
          one_liner: string | null
          stack: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          docs?: Json
          generation_id?: string | null
          id?: string
          name: string
          one_liner?: string | null
          stack?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          docs?: Json
          generation_id?: string | null
          id?: string
          name?: string
          one_liner?: string | null
          stack?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_projects_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          credits: number
          expires_at: string | null
          is_redeemed: boolean
          redeemed_at: string | null
          redeemed_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          credits: number
          expires_at?: string | null
          is_redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          credits?: number
          expires_at?: string | null
          is_redeemed?: boolean
          redeemed_at?: string | null
          redeemed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_user_activity: {
        Args: { p_days?: number }
        Returns: {
          credits_spent: number
          credits_total: number
          display_name: string
          email: string
          generations: number
          is_banned: boolean
          is_pro: boolean
          joined: string
          last_active: string
          modules_used: string[]
          role: string
          user_id: string
        }[]
      }
      charge_auto_clip_job: {
        Args: {
          p_credit_ref: string
          p_job: string
          p_worker_token_hash: string
        }
        Returns: {
          bridge_claimed_at: string | null
          bridge_token_expires_at: string | null
          bridge_token_hash: string | null
          bridge_token_used_at: string | null
          caption_preset: string
          clip_title: string
          created_at: string
          credit_amount: number
          credit_ref: string | null
          end_time: number
          error_code: string | null
          error_message: string | null
          focus: string
          id: string
          language: string
          output_bytes: number | null
          output_name: string | null
          progress: number
          ratio: string
          source_url: string
          stage: string | null
          start_time: number
          status: string
          title: string
          updated_at: string
          user_id: string
          video_id: string
          worker_token_expires_at: string | null
          worker_token_hash: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "auto_clip_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_auto_clip_job: {
        Args: {
          p_credit_ref: string
          p_job: string
          p_token_hash: string
          p_worker_token_hash: string
        }
        Returns: {
          bridge_claimed_at: string | null
          bridge_token_expires_at: string | null
          bridge_token_hash: string | null
          bridge_token_used_at: string | null
          caption_preset: string
          clip_title: string
          created_at: string
          credit_amount: number
          credit_ref: string | null
          end_time: number
          error_code: string | null
          error_message: string | null
          focus: string
          id: string
          language: string
          output_bytes: number | null
          output_name: string | null
          progress: number
          ratio: string
          source_url: string
          stage: string | null
          start_time: number
          status: string
          title: string
          updated_at: string
          user_id: string
          video_id: string
          worker_token_expires_at: string | null
          worker_token_hash: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "auto_clip_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_daily_refill: { Args: { p_user: string }; Returns: number }
      consume_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_user: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          request_count: number
          retry_after_seconds: number
        }[]
      }
      gemini_pool_report_today: {
        Args: never
        Returns: {
          errors: number
          key_index: number
          last_used_at: string
          requests: number
          tokens: number
        }[]
      }
      gemini_pool_used_today: {
        Args: never
        Returns: {
          errors: number
          key_index: number
          requests: number
        }[]
      }
      gen_referral_code: { Args: never; Returns: string }
      grant_credits: {
        Args: {
          p_amount: number
          p_bucket: string
          p_reason: string
          p_ref?: string
          p_user: string
        }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      record_gemini_usage: {
        Args: {
          p_input_tokens?: number
          p_is_error?: boolean
          p_key_index: number
          p_model: string
          p_output_tokens?: number
          p_tokens?: number
        }
        Returns: undefined
      }
      refund_credits:
        | {
            Args: { p_amount: number; p_reason: string; p_user: string }
            Returns: number
          }
        | {
            Args: { p_reason?: string; p_ref: string; p_user: string }
            Returns: number
          }
      spend_credits: {
        Args: {
          p_amount: number
          p_reason: string
          p_ref?: string
          p_user: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Project convenience aliases. `supabase gen types` owns schema declarations above.
export type CreatorDna = Tables<"creator_dna">
export type Draft = Tables<"drafts">
export type Persona = Tables<"personas">
export type PipelineCard = Tables<"pipeline_cards">
export type ProofVerdict = "pass" | "suspect" | "fail" | "error" | "unchecked"
