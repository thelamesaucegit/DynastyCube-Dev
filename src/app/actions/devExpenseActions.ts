//src/app/actions/devExpenseActions.ts

"use server";

import { createServerClient, type AnySupabaseClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache"; 

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

export interface PublicMonthlyExpense {
  month: string; // "YYYY-MM-01"
  monthLabel: string; // "May 2025"
  totalCost: number;
  devOwed: number;
  devPaid: number;
  hostingCost: number;
  raisedAmount: number;
  customCosts: CustomCost[];
}

export interface PublicYearlyExpense {
  year: string;
  totalCost: number;
  devOwed: number;
  devPaid: number;
  raisedAmount: number;
  monthlyBreakdown: PublicMonthlyExpense[];
}

export interface PublicExpenseSummary {
  grandTotalCost: number;
  grandTotalDevOwed: number;
  grandTotalDevPaid: number;
  grandTotalRaised: number;
  yearlyBreakdown: PublicYearlyExpense[];
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

/**
 * Public action to get expense summaries. 
 * Explicitly strips out dev_hours and hourly_rate.
 */
export async function getPublicExpenseStats(): Promise<{ stats: PublicExpenseSummary | null; error?: string }> {
  noStore(); 
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("dev_expenses")
      .select("*")
      .order("expense_month", { ascending: false });

    if (error) return { stats: null, error: error.message };

    let grandTotalCost = 0;
    let grandTotalDevOwed = 0;
    let grandTotalDevPaid = 0;
    let grandTotalRaised = 0;

    const yearlyMap = new Map<string, PublicYearlyExpense>();

    (data || []).forEach(row => {
      const dateObj = new Date(row.expense_month);
      const year = dateObj.getUTCFullYear().toString();
      const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

      const devOwedForMonth = Number(row.dev_hours) * Number(row.hourly_rate);
      const customTotal = (row.custom_costs as CustomCost[] || []).reduce((sum, c) => sum + Number(c.amount), 0);
      const monthlyTotalCost = devOwedForMonth + Number(row.hosting_cost) + customTotal;
      
      const devPaid = Number(row.dev_paid);
      const raised = Number(row.raised_amount) + Number(row.site_revenue);

      // Add to Grand Totals
      grandTotalCost += monthlyTotalCost;
      grandTotalDevOwed += devOwedForMonth;
      grandTotalDevPaid += devPaid;
      grandTotalRaised += raised;

      // Ensure year entry exists in the map
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { year, totalCost: 0, devOwed: 0, devPaid: 0, raisedAmount: 0, monthlyBreakdown: [] });
      }
      
      const yearStats = yearlyMap.get(year)!;
      
      // Aggregate yearly totals
      yearStats.totalCost += monthlyTotalCost;
      yearStats.devOwed += devOwedForMonth;
      yearStats.devPaid += devPaid;
      yearStats.raisedAmount += raised;

      // Add the detailed monthly breakdown
      yearStats.monthlyBreakdown.push({
        month: row.expense_month,
        monthLabel: monthLabel,
        totalCost: monthlyTotalCost,
        devOwed: devOwedForMonth,
        devPaid: devPaid,
        hostingCost: Number(row.hosting_cost),
        raisedAmount: raised,
        customCosts: (row.custom_costs as CustomCost[]) || [],
      });
    });

    const yearlyBreakdown = Array.from(yearlyMap.values()).sort((a, b) => Number(b.year) - Number(a.year));

    return {
      stats: {
        grandTotalCost,
        grandTotalDevOwed,
        grandTotalDevPaid,
        grandTotalRaised,
        yearlyBreakdown
      }
    };
  } catch (error) {
    return { stats: null, error: error instanceof Error ? error.message : String(error) };
  }
}
