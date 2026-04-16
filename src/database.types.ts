// src/lib/database.types.ts

// The Json type is a standard requirement for Supabase types.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Define the Database interface with strict, non-empty types.
export interface Database {
  public: {
    // We don't need Tables, Views, etc., for this operation,
    // so we explicitly define them as empty records.
    Tables: Record<string, never>
    Views: Record<string, never>
    
    // This is the only part we actually need.
    Functions: {
      append_batch_to_match_logs: {
        Args: {
          match_id_to_append: string
          // The argument is a JSON array, which fits our Json type.
          new_states_to_append: Json
        }
        // The SQL function itself returns void.
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
