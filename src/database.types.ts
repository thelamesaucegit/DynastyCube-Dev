// src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // You can add your table definitions here if needed later
      // For now, we only need the Functions part
      sim_matches: {
        Row: {
          id: string
          argentum_game_states: Json | null
          //... add other columns if you need them
        }
        // ... Insert, Update definitions
      }
    }
    Views: {
      // ...
    }
    Functions: {
      append_batch_to_match_logs: {
        Args: {
          match_id_to_append: string
          new_states_to_append: Json
        }
        Returns: void
      }
    }
    Enums: {
      // ...
    }
    CompositeTypes: {
      // ...
    }
  }
}
