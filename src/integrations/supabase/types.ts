export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          kind: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          kind: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_kits: {
        Row: {
          company_id: string;
          created_at: string;
          fonts: Json | null;
          id: string;
          logo_url: string | null;
          options: Json;
          palette: Json | null;
          selected_index: number | null;
          tone: string | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          fonts?: Json | null;
          id?: string;
          logo_url?: string | null;
          options?: Json;
          palette?: Json | null;
          selected_index?: number | null;
          tone?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          fonts?: Json | null;
          id?: string;
          logo_url?: string | null;
          options?: Json;
          palette?: Json | null;
          selected_index?: number | null;
          tone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_kits_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          cnpj: string | null;
          created_at: string;
          employees: string | null;
          id: string;
          instagram_handle: string | null;
          linkedin_url: string | null;
          name: string;
          onboarding_step: string;
          owner_id: string;
          research: Json;
          segment: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          cnpj?: string | null;
          created_at?: string;
          employees?: string | null;
          id?: string;
          instagram_handle?: string | null;
          linkedin_url?: string | null;
          name: string;
          onboarding_step?: string;
          owner_id: string;
          research?: Json;
          segment?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          cnpj?: string | null;
          created_at?: string;
          employees?: string | null;
          id?: string;
          instagram_handle?: string | null;
          linkedin_url?: string | null;
          name?: string;
          onboarding_step?: string;
          owner_id?: string;
          research?: Json;
          segment?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          caption: string | null;
          channel: string;
          company_id: string;
          created_at: string;
          cta: string | null;
          format: string;
          hashtags: string | null;
          id: string;
          image_path: string | null;
          image_url: string | null;
          pillar: string | null;
          plan_id: string | null;
          scheduled_for: string;
          script: string | null;
          slides: Json;
          status: string;
          storyboard: Json | null;
          title: string;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          caption?: string | null;
          channel?: string;
          company_id: string;
          created_at?: string;
          cta?: string | null;
          format?: string;
          hashtags?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          pillar?: string | null;
          plan_id?: string | null;
          scheduled_for: string;
          script?: string | null;
          slides?: Json;
          status?: string;
          storyboard?: Json | null;
          title: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          caption?: string | null;
          channel?: string;
          company_id?: string;
          created_at?: string;
          cta?: string | null;
          format?: string;
          hashtags?: string | null;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          pillar?: string | null;
          plan_id?: string | null;
          scheduled_for?: string;
          script?: string | null;
          slides?: Json;
          status?: string;
          storyboard?: Json | null;
          title?: string;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_items_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "content_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      content_plans: {
        Row: {
          company_id: string;
          created_at: string;
          frequency: Json;
          id: string;
          month: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          frequency?: Json;
          id?: string;
          month: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          frequency?: Json;
          id?: string;
          month?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_plans_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnostics: {
        Row: {
          answers: Json;
          company_id: string;
          created_at: string;
          id: string;
          report: Json | null;
          score: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          answers?: Json;
          company_id: string;
          created_at?: string;
          id?: string;
          report?: Json | null;
          score?: number | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          answers?: Json;
          company_id?: string;
          created_at?: string;
          id?: string;
          report?: Json | null;
          score?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnostics_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      metrics_snapshots: {
        Row: {
          captured_for: string;
          company_id: string;
          created_at: string;
          id: string;
          metrics: Json;
          provider: string;
        };
        Insert: {
          captured_for: string;
          company_id: string;
          created_at?: string;
          id?: string;
          metrics?: Json;
          provider: string;
        };
        Update: {
          captured_for?: string;
          company_id?: string;
          created_at?: string;
          id?: string;
          metrics?: Json;
          provider?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metrics_snapshots_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      missions: {
        Row: {
          category: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          id: string;
          order_index: number;
          status: string;
          title: string;
          updated_at: string;
          xp: number;
        };
        Insert: {
          category?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          order_index?: number;
          status?: string;
          title: string;
          updated_at?: string;
          xp?: number;
        };
        Update: {
          category?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          order_index?: number;
          status?: string;
          title?: string;
          updated_at?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "missions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          consent_accepted_at: string | null;
          consent_version: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          consent_accepted_at?: string | null;
          consent_version?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          consent_accepted_at?: string | null;
          consent_version?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      scheduled_posts: {
        Row: {
          company_id: string;
          content_item_id: string | null;
          created_at: string;
          error_message: string | null;
          external_post_id: string | null;
          id: string;
          provider: string;
          published_at: string | null;
          scheduled_for: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          content_item_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          external_post_id?: string | null;
          id?: string;
          provider: string;
          published_at?: string | null;
          scheduled_for: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          content_item_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          external_post_id?: string | null;
          id?: string;
          provider?: string;
          published_at?: string | null;
          scheduled_for?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheduled_posts_content_item_id_fkey";
            columns: ["content_item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
      social_account_secrets: {
        Row: {
          access_token: string | null;
          refresh_token: string | null;
          social_account_id: string;
          token_expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          access_token?: string | null;
          refresh_token?: string | null;
          social_account_id: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          access_token?: string | null;
          refresh_token?: string | null;
          social_account_id?: string;
          token_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_account_secrets_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: true;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      social_accounts: {
        Row: {
          company_id: string;
          created_at: string;
          external_id: string | null;
          id: string;
          provider: string;
          status: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          provider: string;
          status?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_accounts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_progress: {
        Row: {
          company_id: string;
          level: number;
          updated_at: string;
          xp: number;
        };
        Insert: {
          company_id: string;
          level?: number;
          updated_at?: string;
          xp?: number;
        };
        Update: {
          company_id?: string;
          level?: number;
          updated_at?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_progress_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_and_record_ai_usage: {
        Args: {
          _company_id: string;
          _daily_limit: number;
          _kind: string;
          _monthly_limit: number;
        };
        Returns: boolean;
      };
      complete_mission: {
        Args: { _mission_id: string };
        Returns: { new_level: number; new_xp: number }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      owns_company: { Args: { _company_id: string }; Returns: boolean };
      owns_company_folder: { Args: { _folder: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "client";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client"],
    },
  },
} as const;
