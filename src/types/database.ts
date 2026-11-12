
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "listings": {
                  Row: {
                    "amenities": (string)[],"area": string,"available_from": string,"deposit": number | null,"furnished": boolean | null,"host_id": string,"id": string,"occupancy": number | null,"rent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amenities"?: (string)[],"area": string,"available_from": string,"deposit"?: number | null,"furnished"?: boolean | null,"host_id": string,"id"?: string,"occupancy"?: number | null,"rent": number
                  }
                  Update: {
                    "amenities"?: (string)[],"area"?: string,"available_from"?: string,"deposit"?: number | null,"furnished"?: boolean | null,"host_id"?: string,"id"?: string,"occupancy"?: number | null,"rent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_host_id_fkey"
      columns: ["host_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "created_at": string,"id": string,"unmatched_at": string | null,"user_a": string,"user_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"unmatched_at"?: string | null,"user_a": string,"user_b": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"unmatched_at"?: string | null,"user_a"?: string,"user_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"match_id": string,"read_at": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"match_id": string,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"match_id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "id": string,"is_room_photo": boolean,"position": number,"profile_id": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_room_photo"?: boolean,"position": number,"profile_id": string,"url": string
                  }
                  Update: {
                    "id"?: string,"is_room_photo"?: boolean,"position"?: number,"profile_id"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"preferences": {
                  Row: {
                    "cleanliness": number | null,"dealbreakers": (Database["public"]['Enums']["dealbreaker_field"])[],"drinking": Database["public"]['Enums']["habit_preference"] | null,"food": Database["public"]['Enums']["food_preference"] | null,"guests": Database["public"]['Enums']["guests_preference"] | null,"language": (string)[],"pets": Database["public"]['Enums']["pets_preference"] | null,"profile_id": string,"sleep": Database["public"]['Enums']["sleep_schedule"] | null,"smoking": Database["public"]['Enums']["habit_preference"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cleanliness"?: number | null,"dealbreakers"?: (Database["public"]['Enums']["dealbreaker_field"])[],"drinking"?: Database["public"]['Enums']["habit_preference"] | null,"food"?: Database["public"]['Enums']["food_preference"] | null,"guests"?: Database["public"]['Enums']["guests_preference"] | null,"language"?: (string)[],"pets"?: Database["public"]['Enums']["pets_preference"] | null,"profile_id": string,"sleep"?: Database["public"]['Enums']["sleep_schedule"] | null,"smoking"?: Database["public"]['Enums']["habit_preference"] | null
                  }
                  Update: {
                    "cleanliness"?: number | null,"dealbreakers"?: (Database["public"]['Enums']["dealbreaker_field"])[],"drinking"?: Database["public"]['Enums']["habit_preference"] | null,"food"?: Database["public"]['Enums']["food_preference"] | null,"guests"?: Database["public"]['Enums']["guests_preference"] | null,"language"?: (string)[],"pets"?: Database["public"]['Enums']["pets_preference"] | null,"profile_id"?: string,"sleep"?: Database["public"]['Enums']["sleep_schedule"] | null,"smoking"?: Database["public"]['Enums']["habit_preference"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "preferences_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "areas": (string)[],"bio": string | null,"city": string | null,"dob": string,"gender": Database["public"]['Enums']["gender"] | null,"id": string,"is_paused": boolean,"last_active_at": string,"max_budget": number | null,"move_in_date": string | null,"name": string,"occupation": string | null,"seeking_type": Database["public"]['Enums']["seeking_type"] | null,"show_to_genders": (Database["public"]['Enums']["gender"])[],"want_genders": (Database["public"]['Enums']["gender"])[]
                  }
                  ComputedFields: never
                  Insert: {
                    "areas"?: (string)[],"bio"?: string | null,"city"?: string | null,"dob": string,"gender"?: Database["public"]['Enums']["gender"] | null,"id": string,"is_paused"?: boolean,"last_active_at"?: string,"max_budget"?: number | null,"move_in_date"?: string | null,"name": string,"occupation"?: string | null,"seeking_type"?: Database["public"]['Enums']["seeking_type"] | null,"show_to_genders"?: (Database["public"]['Enums']["gender"])[],"want_genders"?: (Database["public"]['Enums']["gender"])[]
                  }
                  Update: {
                    "areas"?: (string)[],"bio"?: string | null,"city"?: string | null,"dob"?: string,"gender"?: Database["public"]['Enums']["gender"] | null,"id"?: string,"is_paused"?: boolean,"last_active_at"?: string,"max_budget"?: number | null,"move_in_date"?: string | null,"name"?: string,"occupation"?: string | null,"seeking_type"?: Database["public"]['Enums']["seeking_type"] | null,"show_to_genders"?: (Database["public"]['Enums']["gender"])[],"want_genders"?: (Database["public"]['Enums']["gender"])[]
                  }
                  Relationships: [
                    
                  ]
                },"prompts": {
                  Row: {
                    "answer": string,"id": string,"position": number,"profile_id": string,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"id"?: string,"position": number,"profile_id": string,"question": string
                  }
                  Update: {
                    "answer"?: string,"id"?: string,"position"?: number,"profile_id"?: string,"question"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prompts_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_tokens": {
                  Row: {
                    "profile_id": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"token": string
                  }
                  Update: {
                    "profile_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports_blocks": {
                  Row: {
                    "created_at": string,"id": string,"reason": string | null,"reporter_id": string,"target_id": string,"type": Database["public"]['Enums']["report_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason"?: string | null,"reporter_id": string,"target_id": string,"type": Database["public"]['Enums']["report_type"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string | null,"reporter_id"?: string,"target_id"?: string,"type"?: Database["public"]['Enums']["report_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_blocks_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_blocks_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"swipes": {
                  Row: {
                    "action": Database["public"]['Enums']["swipe_action"],"comment": string | null,"created_at": string,"liked_item": string | null,"swiper_id": string,"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["swipe_action"],"comment"?: string | null,"created_at"?: string,"liked_item"?: string | null,"swiper_id": string,"target_id": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["swipe_action"],"comment"?: string | null,"created_at"?: string,"liked_item"?: string | null,"swiper_id"?: string,"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "swipes_swiper_id_fkey"
      columns: ["swiper_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "get_feed":
{ Args: { "p_cursor"?: string,"p_limit"?: number,"p_user_id": string }; Returns: {
              "age": number,"areas": (string)[],"bio": string,"city": string,"gender": Database["public"]['Enums']["gender"],"listing": Json,"match_score": number,"max_budget": number,"move_in_date": string,"name": string,"next_cursor": string,"occupation": string,"photos": Json,"preferences": Json,"profile_id": string,"prompts": Json,"rank_score": number,"seeking_type": Database["public"]['Enums']["seeking_type"]
            }[]
                           }
          }
          Enums: {
            "dealbreaker_field": "food"|"smoking"|"drinking"|"sleep"|"guests"|"pets","food_preference": "veg"|"non-veg"|"egg","gender": "male"|"female"|"non_binary","guests_preference": "never"|"sometimes"|"often","habit_preference": "no"|"okay"|"yes","pets_preference": "has_pets"|"okay"|"no_pets","report_type": "report"|"block","seeking_type": "need_place"|"have_place","sleep_schedule": "early"|"late","swipe_action": "like"|"pass"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "dealbreaker_field": ["food", "smoking", "drinking", "sleep", "guests", "pets"],"food_preference": ["veg", "non-veg", "egg"],"gender": ["male", "female", "non_binary"],"guests_preference": ["never", "sometimes", "often"],"habit_preference": ["no", "okay", "yes"],"pets_preference": ["has_pets", "okay", "no_pets"],"report_type": ["report", "block"],"seeking_type": ["need_place", "have_place"],"sleep_schedule": ["early", "late"],"swipe_action": ["like", "pass"]
          }
        }
} as const
