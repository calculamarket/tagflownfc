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
      landing_pages: {
        Row: {
          buttons: Json
          created_at: string
          description: string | null
          image_url: string | null
          lead_form: Json
          logo_url: string | null
          map: Json | null
          tag_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buttons?: Json
          created_at?: string
          description?: string | null
          image_url?: string | null
          lead_form?: Json
          logo_url?: string | null
          map?: Json | null
          tag_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buttons?: Json
          created_at?: string
          description?: string | null
          image_url?: string | null
          lead_form?: Json
          logo_url?: string | null
          map?: Json | null
          tag_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: true
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          phone: string | null
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          phone?: string | null
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_tags: number
          name: string
          price_cents: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          max_tags?: number
          name: string
          price_cents?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_tags?: number
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reads: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: number
          ip: string | null
          os: string | null
          referrer: string | null
          source: string | null
          tag_id: string
          user_agent: string | null
          variant: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: number
          ip?: string | null
          os?: string | null
          referrer?: string | null
          source?: string | null
          tag_id: string
          user_agent?: string | null
          variant?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: number
          ip?: string | null
          os?: string | null
          referrer?: string | null
          source?: string | null
          tag_id?: string
          user_agent?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reads_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_batches: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          name: string
          notes: string | null
          quantity: number
          slots: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          quantity?: number
          slots?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          slots?: number | null
        }
        Relationships: []
      }
      tag_kits: {
        Row: {
          batch_id: string | null
          claim_code: string | null
          claimed_at: string | null
          created_at: string
          id: string
          model: string
          slots: number
          user_id: string | null
        }
        Insert: {
          batch_id?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          model: string
          slots: number
          user_id?: string | null
        }
        Update: {
          batch_id?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          model?: string
          slots?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_kits_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "tag_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_rules: {
        Row: {
          condition_type: string
          condition_value: Json
          created_at: string
          destination_url: string
          id: string
          priority: number
          tag_id: string
          user_id: string
        }
        Insert: {
          condition_type: string
          condition_value?: Json
          created_at?: string
          destination_url: string
          id?: string
          priority?: number
          tag_id: string
          user_id: string
        }
        Update: {
          condition_type?: string
          condition_value?: Json
          created_at?: string
          destination_url?: string
          id?: string
          priority?: number
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          access_password: string | null
          activate_at: string | null
          batch_id: string | null
          category: string | null
          claim_code: string | null
          claimed_at: string | null
          created_at: string
          description: string | null
          destination: Json
          destination_type: Database["public"]["Enums"]["destination_type"]
          expire_at: string | null
          id: string
          kit_id: string | null
          max_scans: number | null
          name: string
          qr_style: Json
          read_count: number
          slot: number | null
          slot_label: string | null
          status: Database["public"]["Enums"]["tag_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_password?: string | null
          activate_at?: string | null
          batch_id?: string | null
          category?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          destination?: Json
          destination_type?: Database["public"]["Enums"]["destination_type"]
          expire_at?: string | null
          id: string
          kit_id?: string | null
          max_scans?: number | null
          name: string
          qr_style?: Json
          read_count?: number
          slot?: number | null
          slot_label?: string | null
          status?: Database["public"]["Enums"]["tag_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_password?: string | null
          activate_at?: string | null
          batch_id?: string | null
          category?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          destination?: Json
          destination_type?: Database["public"]["Enums"]["destination_type"]
          expire_at?: string | null
          id?: string
          kit_id?: string | null
          max_scans?: number | null
          name?: string
          qr_style?: Json
          read_count?: number
          slot?: number | null
          slot_label?: string | null
          status?: Database["public"]["Enums"]["tag_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "tag_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "tag_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          error: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id: string
          ok: boolean
          payload: Json
          status_code: number | null
          url: string
          user_id: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id?: string
          ok?: boolean
          payload?: Json
          status_code?: number | null
          url: string
          user_id: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          ok?: boolean
          payload?: Json
          status_code?: number | null
          url?: string
          user_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          event: Database["public"]["Enums"]["webhook_event"]
          id: string
          secret: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event: Database["public"]["Enums"]["webhook_event"]
          id?: string
          secret?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          secret?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      destination_type:
        | "url"
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "tiktok"
        | "youtube"
        | "pdf"
        | "pix"
        | "wifi"
        | "phone"
        | "email"
        | "landing_page"
        | "mercadolivre"
        | "shopee"
        | "amazon"
        | "vcard"
        | "review_gate"
        | "ab_test"
        | "links"
      tag_status: "active" | "paused" | "archived"
      webhook_event: "tag.read" | "tag.created" | "tag.updated"
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
    Enums: {
      app_role: ["admin", "user"],
      destination_type: [
        "url",
        "whatsapp",
        "instagram",
        "facebook",
        "tiktok",
        "youtube",
        "pdf",
        "pix",
        "wifi",
        "phone",
        "email",
        "landing_page",
        "mercadolivre",
        "shopee",
        "amazon",
        "vcard",
        "review_gate",
        "ab_test",
      ],
      tag_status: ["active", "paused", "archived"],
      webhook_event: ["tag.read", "tag.created", "tag.updated"],
    },
  },
} as const
