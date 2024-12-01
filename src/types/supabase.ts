export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: number;
          high_price_threshold: number;
          low_price_threshold: number;
          renewable_threshold: number;
          notification_email: string;
          user_first_name: string;
          notifications_enabled: boolean;
          quiet_hours_enabled: boolean;
          quiet_hours_start: string;
          quiet_hours_end: string;
          created_at: string;
          updated_at: string;
          active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
    };
  };
}
