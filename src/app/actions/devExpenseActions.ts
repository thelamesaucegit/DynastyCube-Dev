//src/app/actions/devExpenseActions.ts

"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";

export interface CustomCost {
  id: string;
  description: string;
  amount: number;
}

export interface DevExpense {
  expense_month: string; 
  dev_hours: number;
  hourly_rate: number;
  hosting_cost: number;
  dev_paid: number;          
  raised_amount: number;     
  site_revenue: number;      
  custom_costs: CustomCost[];
  created_at?: string;
  updated_at?: string;
}

async function verifyAdmin(supabase: AnySupabaseClient): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { authorized: false, error: "Not authenticated" };

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.is_admin) {
    return { authorized: false, userId: user.id, error: "Unauthorized: Admin access required" };
  }
  return { authorized: true, userId: user.id };
}

export async function getDevExpenses(): Promise<{ expenses: DevExpense[]; error?: string }> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("dev_expenses")
      .select("*")
      .order("expense_month", { ascending: false });

    if (error) return { expenses: [], error: error.message };

    const expenses: DevExpense[] = (data || []).map((row) => ({
      expense_month: row.expense_month,
      dev_hours: Number(row.dev_hours),
      hourly_rate: Number(row.hourly_rate),
      hosting_cost: Number(row.hosting_cost),
      dev_paid: Number(row.dev_paid),             
      raised_amount: Number(row.raised_amount), 
      site_revenue: Number(row.site_revenue),    
      custom_costs: (row.custom_costs as CustomCost[]) || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { expenses };
  } catch (error) {
    return { expenses: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function upsertDevExpense(
  expenseMonth: string,
  updates: Partial<Omit<DevExpense, "expense_month" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient();
    const admin = await verifyAdmin(supabase);
    if (!admin.authorized) return { success: false, error: admin.error };

    const dateObj = new Date(expenseMonth);
    const monthString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-01`;

    const { error } = await supabase
      .from("dev_expenses")
      .upsert({
        expense_month: monthString,
        ...(updates.dev_hours !== undefined && { dev_hours: updates.dev_hours }),
        ...(updates.hourly_rate !== undefined && { hourly_rate: updates.hourly_rate }),
        ...(updates.hosting_cost !== undefined && { hosting_cost: updates.hosting_cost }),
        ...(updates.dev_paid !== undefined && { dev_paid: updates.dev_paid }),                
        ...(updates.raised_amount !== undefined && { raised_amount: updates.raised_amount }), 
        ...(updates.site_revenue !== undefined && { site_revenue: updates.site_revenue }),    
        ...(updates.custom_costs !== undefined && { custom_costs: updates.custom_costs }),
        updated_at: new Date().toISOString(),
      }, { onConflict: "expense_month" });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
