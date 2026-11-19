export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: "guest" | "host" | "admin";
          is_host: boolean;
          phone: string | null;
          whatsapp: string | null;
          country_of_residence: string | null;
          city_of_residence: string | null;
          country_of_origin: string | null;
          account_purpose: string[];
          preferred_contact: "email" | "phone" | "whatsapp";
          bio: string | null;
          profile_completed_at: string | null;
          account_type: "individual" | "agency";
          company_name: string | null;
          verification_status: "unverified" | "pending" | "approved" | "rejected";
          verification_note: string | null;
          verification_reasons: ("unreadable" | "expired" | "name_mismatch" | "incomplete" | "wrong_document" | "company_mismatch")[];
          verification_submitted_at: string | null;
          verification_reviewed_at: string | null;
          verification_reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "guest" | "host" | "admin";
          is_host?: boolean;
          phone?: string | null;
          whatsapp?: string | null;
          country_of_residence?: string | null;
          city_of_residence?: string | null;
          country_of_origin?: string | null;
          account_purpose?: string[];
          preferred_contact?: "email" | "phone" | "whatsapp";
          bio?: string | null;
          profile_completed_at?: string | null;
          account_type?: "individual" | "agency";
          company_name?: string | null;
          verification_status?: "unverified" | "pending" | "approved" | "rejected";
          verification_note?: string | null;
          verification_reasons?: ("unreadable" | "expired" | "name_mismatch" | "incomplete" | "wrong_document" | "company_mismatch")[];
          verification_submitted_at?: string | null;
          verification_reviewed_at?: string | null;
          verification_reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "guest" | "host" | "admin";
          is_host?: boolean;
          phone?: string | null;
          whatsapp?: string | null;
          country_of_residence?: string | null;
          city_of_residence?: string | null;
          country_of_origin?: string | null;
          account_purpose?: string[];
          preferred_contact?: "email" | "phone" | "whatsapp";
          bio?: string | null;
          profile_completed_at?: string | null;
          account_type?: "individual" | "agency";
          company_name?: string | null;
          verification_status?: "unverified" | "pending" | "approved" | "rejected";
          verification_note?: string | null;
          verification_reasons?: ("unreadable" | "expired" | "name_mismatch" | "incomplete" | "wrong_document" | "company_mismatch")[];
          verification_submitted_at?: string | null;
          verification_reviewed_at?: string | null;
          verification_reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      listing_private_locations: {
        Row: {
          listing_id: string;
          latitude: number | null;
          longitude: number | null;
          address_details: string | null;
          updated_at: string;
        };
        Insert: {
          listing_id: string;
          latitude?: number | null;
          longitude?: number | null;
          address_details?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_private_locations"]["Insert"]>;
        Relationships: [];
      };
      verification_documents: {
        Row: {
          id: string;
          user_id: string;
          kind: "id_front" | "id_back" | "rccm" | "ifu" | "manager_id_front" | "manager_id_back";
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: "id_front" | "id_back" | "rccm" | "ifu" | "manager_id_front" | "manager_id_back";
          storage_path: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["verification_documents"]["Insert"]>;
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          translations: Json;
          description: string;
          category: string;
          type: string | null;
          country: string | null;
          region: string | null;
          latitude: number | null;
          longitude: number | null;
          price_per_night: number;
          asset_type:
            | "short_stay"
            | "house_rent"
            | "house_sale"
            | "land_sale"
            | "commercial_rent"
            | "commercial_sale"
            | "other";
          transaction_type: "booking" | "rent" | "sale" | "lead";
          currency: string;
          sale_price: number | null;
          monthly_rent: number | null;
          area_sqm: number | null;
          land_title_status: string | null;
          property_condition: string | null;
          available_from: string | null;
          address_details: string | null;
          city: string | null;
          district: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_whatsapp: string | null;
          contact_email: string | null;
          guest_count: number;
          room_count: number;
          bathroom_count: number;
          amenities: string[];
          status: "draft" | "pending_review" | "published" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          translations?: Json;
          description: string;
          category: string;
          type?: string | null;
          country?: string | null;
          region?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          price_per_night: number;
          asset_type?:
            | "short_stay"
            | "house_rent"
            | "house_sale"
            | "land_sale"
            | "commercial_rent"
            | "commercial_sale"
            | "other";
          transaction_type?: "booking" | "rent" | "sale" | "lead";
          currency?: string;
          sale_price?: number | null;
          monthly_rent?: number | null;
          area_sqm?: number | null;
          land_title_status?: string | null;
          property_condition?: string | null;
          available_from?: string | null;
          address_details?: string | null;
          city?: string | null;
          district?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_whatsapp?: string | null;
          contact_email?: string | null;
          guest_count?: number;
          room_count?: number;
          bathroom_count?: number;
          amenities?: string[];
          status?: "draft" | "pending_review" | "published" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
        Relationships: [];
      };
      listing_photos: {
        Row: {
          id: string;
          listing_id: string;
          storage_path: string;
          public_url: string | null;
          alt_text: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          storage_path: string;
          public_url?: string | null;
          alt_text?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_photos"]["Insert"]>;
        Relationships: [];
      };
      listing_virtual_tours: {
        Row: {
          id: string;
          listing_id: string;
          provider: "matterport" | "kuula" | "cloudpano" | "panorama" | "other";
          tour_url: string;
          embed_url: string;
          source_type: "external" | "panorama";
          preview_image_url: string | null;
          room_label: string | null;
          position: number;
          status: "active" | "hidden";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          provider?: "matterport" | "kuula" | "cloudpano" | "panorama" | "other";
          tour_url: string;
          embed_url: string;
          source_type?: "external" | "panorama";
          preview_image_url?: string | null;
          room_label?: string | null;
          position?: number;
          status?: "active" | "hidden";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_virtual_tours"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          listing_id: string;
          guest_id: string;
          host_id: string;
          check_in: string;
          check_out: string;
          night_count: number;
          price_per_night: number;
          total_price: number;
          status:
            | "pending_payment"
            | "confirmed"
            | "cancelled_by_guest"
            | "cancelled_by_host"
            | "completed"
            | "refunded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          guest_id: string;
          host_id: string;
          check_in: string;
          check_out: string;
          night_count: number;
          price_per_night: number;
          total_price: number;
          status?:
            | "pending_payment"
            | "confirmed"
            | "cancelled_by_guest"
            | "cancelled_by_host"
            | "completed"
            | "refunded";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string | null;
          user_id: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          provider: string;
          provider_transaction_id: string | null;
          amount: number;
          currency: string;
          status: "pending" | "paid" | "failed" | "refunded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id?: string | null;
          user_id: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          provider?: string;
          provider_transaction_id?: string | null;
          amount: number;
          currency?: string;
          status?: "pending" | "paid" | "failed" | "refunded";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      listing_inquiries: {
        Row: {
          id: string;
          listing_id: string;
          buyer_id: string | null;
          seller_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          message: string;
          status: "new" | "contacted" | "closed" | "spam";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          buyer_id?: string | null;
          seller_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          message: string;
          status?: "new" | "contacted" | "closed" | "spam";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["listing_inquiries"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          listing_id: string;
          guest_id: string;
          host_id: string;
          last_message_at: string;
          guest_last_read_at: string | null;
          host_last_read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          guest_id: string;
          host_id: string;
          last_message_at?: string;
          guest_last_read_at?: string | null;
          host_last_read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          reply_to_id: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          reply_to_id?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          account_type: "individual" | "agency";
          company_name: string | null;
          is_verified: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_message: {
        Args: { message_id: string };
        Returns: undefined;
      };
      listings_near: {
        Args: { lat: number; lng: number; radius_km?: number; max_results?: number };
        Returns: { listing_id: string; distance_km: number }[];
      };
      submit_verification: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      unavailable_listing_ids: {
        Args: { start_date: string; end_date: string };
        Returns: string[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
