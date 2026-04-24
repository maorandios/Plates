export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string | null;
          created_by: string | null;
          onboarding_completed: boolean;
          onboarding_pending: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          created_by?: string | null;
          onboarding_completed?: boolean;
          onboarding_pending?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          created_by?: string | null;
          onboarding_completed?: boolean;
          onboarding_pending?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          org_id: string;
          user_id: string;
          role?: string;
        };
        Update: {
          org_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          org_id: string;
          email: string | null;
          app_preferences: Json | null;
          material_config: Json | null;
          cutting_profiles: Json | null;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          email?: string | null;
          app_preferences?: Json | null;
          material_config?: Json | null;
          cutting_profiles?: Json | null;
          updated_at?: string;
        };
        Update: {
          org_id?: string;
          email?: string | null;
          app_preferences?: Json | null;
          material_config?: Json | null;
          cutting_profiles?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      org_domain_snapshots: {
        Row: {
          org_id: string;
          data_key: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          data_key: string;
          payload: Json;
          updated_at?: string;
        };
        Update: {
          org_id?: string;
          data_key?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          org_id: string;
          full_name: string;
          short_code: string;
          company_registration_number: string | null;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          city: string | null;
          notes: string | null;
          status: string;
          uploaded_file_ids: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          full_name: string;
          short_code: string;
          company_registration_number?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          city?: string | null;
          notes?: string | null;
          status: string;
          uploaded_file_ids?: Json;
          created_at: string;
          updated_at: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          full_name?: string;
          short_code?: string;
          company_registration_number?: string | null;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          city?: string | null;
          notes?: string | null;
          status?: string;
          uploaded_file_ids?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          org_id: string;
          reference_number: string;
          customer_name: string;
          status: string;
          current_step: number;
          wizard_schema: number | null;
          created_at: string;
          updated_at: string;
          customer_client_id: string | null;
          project_name: string | null;
          total_weight_kg: number | null;
          total_area_m2: number | null;
          total_item_qty: number | null;
          total_incl_vat: number | null;
          session_payload: Json | null;
        };
        Insert: {
          id: string;
          org_id: string;
          reference_number: string;
          customer_name: string;
          status: string;
          current_step: number;
          wizard_schema?: number | null;
          created_at: string;
          updated_at: string;
          customer_client_id?: string | null;
          project_name?: string | null;
          total_weight_kg?: number | null;
          total_area_m2?: number | null;
          total_item_qty?: number | null;
          total_incl_vat?: number | null;
          session_payload?: Json | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          reference_number?: string;
          customer_name?: string;
          status?: string;
          current_step?: number;
          wizard_schema?: number | null;
          created_at?: string;
          updated_at?: string;
          customer_client_id?: string | null;
          project_name?: string | null;
          total_weight_kg?: number | null;
          total_area_m2?: number | null;
          total_item_qty?: number | null;
          total_incl_vat?: number | null;
          session_payload?: Json | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          reference_number: string;
          customer_name: string;
          project_name: string | null;
          status: string;
          current_step: number;
          material_type: string;
          created_at: string;
          updated_at: string;
          total_item_qty: number | null;
          total_weight_kg: number | null;
          total_area_m2: number | null;
          session_payload: Json | null;
        };
        Insert: {
          id: string;
          org_id: string;
          reference_number: string;
          customer_name: string;
          project_name?: string | null;
          status: string;
          current_step: number;
          material_type: string;
          created_at: string;
          updated_at: string;
          total_item_qty?: number | null;
          total_weight_kg?: number | null;
          total_area_m2?: number | null;
          session_payload?: Json | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          reference_number?: string;
          customer_name?: string;
          project_name?: string | null;
          status?: string;
          current_step?: number;
          material_type?: string;
          created_at?: string;
          updated_at?: string;
          total_item_qty?: number | null;
          total_weight_kg?: number | null;
          total_area_m2?: number | null;
          session_payload?: Json | null;
        };
        Relationships: [];
      };
      steel_types: {
        Row: {
          id: string;
          org_id: string;
          family: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          family: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          family?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
