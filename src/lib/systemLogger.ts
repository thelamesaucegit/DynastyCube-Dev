// src/lib/systemLogger.ts
import { createClient } from "@supabase/supabase-js";

// Always use service client for backend logs so it bypasses RLS
function createLogClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

type LogLevel = 'info' | 'warn' | 'error';

export async function logSystemEvent(
  processName: string, 
  level: LogLevel, 
  message: string, 
  details?: Record<string, unknown>
) {
  
  // --- If it's NOT an error, just log to console locally and exit ---
  if (level !== 'error') {
    if (process.env.NODE_ENV === 'development') {
      const icon = level === 'warn' ? '⚠️' : 'ℹ️';
      console[level === 'warn' ? 'warn' : 'info'](`${icon} [${processName}] ${message}`, details || '');
    }
    return; 
  }

  // --- If it IS an error, log to console AND save to database ---
  if (process.env.NODE_ENV === 'development') {
    console.error(`❌ [${processName}] ${message}`, details || '');
  }

  const supabase = createLogClient();
  
  try {
    // We don't await this or throw errors from it in a way that would break the main thread.
    // It's a best-effort logging mechanism.
    await supabase.from('system_logs').insert({
      process_name: processName,
      log_level: level,
      message: message,
      details: details || {}
    });
  } catch (e) {
    console.error("Failed to write to system_logs table:", e);
  }
}
