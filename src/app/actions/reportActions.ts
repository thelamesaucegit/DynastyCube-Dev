// src/app/actions/reportActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

interface Report {
  id: string;
  reporter_user_id: string;
  report_type: string;
  reported_user_id: string | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  assigned_admin_id: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

// Submit a new report
export async function submitReport(
  reportType: "bad_actor" | "bug" | "issue" | "other",
  title: string,
  description: string,
  severity: "low" | "medium" | "high" | "critical",
  reportedUserId?: string
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Insert report
    const { data: report, error } = await supabase
      .from("reports")
      .insert({
        reporter_user_id: user.id,
        report_type: reportType,
        reported_user_id: reportedUserId || null,
        title,
        description,
        severity,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admins (this would call the database function)
    try {
      const notifyResult = await supabase.rpc("notify_admins_of_report", {
        p_report_id: report.id,
        p_report_type: reportType,
        p_title: title,
      });

      if (notifyResult.error) {
        console.error("RPC Error:", notifyResult.error);
      }
    } catch (notifyError) {
      console.error("Error notifying admins:", notifyError);
      // Don't fail the report submission if notification fails
    }

    return {
      success: true,
      reportId: report.id,
    };
  } catch (error) {
    console.error("Error submitting report:", error);
    return {
      success: false,
      error: "Failed to submit report",
    };
  }
}

// Get reports for current user
export async function getMyReports(): Promise<{
  reports: Report[];
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { reports: [], success: false, error: "Not authenticated" };
    }

    const { data: reports, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reporter_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return {
      reports: reports || [],
      success: true,
    };
  } catch (error) {
    console.error("Error getting my reports:", error);
    return {
      reports: [],
      success: false,
      error: "Failed to load reports",
    };
  }
}

// Get all reports (admin only)
export async function getAllReports(): Promise<{
  reports: Array<{
    id: string;
    report_type: string;
    title: string;
    description: string;
    severity: string;
    status: string;
    created_at: string;
    reporter_user_id: string;
    reporter_email: string | null;
    reported_user_id: string | null;
    reported_user_email: string | null;
    admin_notes: string | null;
    assigned_admin_id: string | null;
  }>;
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { reports: [], success: false, error: "Not authenticated" };
    }

    // Query reports table directly to get ALL reports (not just pending)
    const { data: reports, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reports:", error);
      throw error;
    }

    // Get user emails separately to avoid RLS issues with auth.users
    const userIds = new Set<string>();
    reports?.forEach(report => {
      if (report.reporter_user_id) userIds.add(report.reporter_user_id);
      if (report.reported_user_id) userIds.add(report.reported_user_id);
    });

    // Fetch emails from public.users table instead of auth.users
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .in("id", Array.from(userIds));

    const userEmailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    // Format the response to match expected structure
    const formattedReports = reports?.map(report => ({
      id: report.id,
      report_type: report.report_type,
      title: report.title,
      description: report.description,
      severity: report.severity,
      status: report.status,
      created_at: report.created_at,
      reporter_user_id: report.reporter_user_id,
      reporter_email: userEmailMap.get(report.reporter_user_id) || null,
      reported_user_id: report.reported_user_id,
      reported_user_email: userEmailMap.get(report.reported_user_id) || null,
      admin_notes: report.admin_notes,
      assigned_admin_id: report.assigned_admin_id
    })) || [];

    return {
      reports: formattedReports,
      success: true,
    };
  } catch (error) {
    console.error("Error getting all reports:", error);
    return {
      reports: [],
      success: false,
      error: "Failed to load reports",
    };
  }
}

// Update report status (admin only)
export async function updateReportStatus(
  reportId: string,
  status: "pending" | "in_review" | "resolved" | "dismissed",
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const updateData: {
      status: string;
      assigned_admin_id: string;
      admin_notes?: string;
    } = {
      status,
      assigned_admin_id: user.id,
    };

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { error } = await supabase.from("reports").update(updateData).eq("id", reportId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error updating report status:", error);
    return {
      success: false,
      error: "Failed to update report",
    };
  }
}

// Get report details
export async function getReportDetails(reportId: string): Promise<{
  report: Report | null;
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { report: null, success: false, error: "Not authenticated" };
    }

    const { data: report, error } = await supabase
      .from("reports")
      .select(
        `
        *,
        reporter:auth.users!reports_reporter_user_id_fkey(email, raw_user_meta_data),
        reported_user:auth.users!reports_reported_user_id_fkey(email, raw_user_meta_data),
        assigned_admin:auth.users!reports_assigned_admin_id_fkey(email, raw_user_meta_data)
      `
      )
      .eq("id", reportId)
      .single();

    if (error) throw error;

    return {
      report: report as unknown as Report | null,
      success: true,
    };
  } catch (error) {
    console.error("Error getting report details:", error);
    return {
      report: null,
      success: false,
      error: "Failed to load report details",
    };
  }
}

// Get report statistics (admin only)
export async function getReportStats(): Promise<{
  stats: {
    pending: number;
    inReview: number;
    resolved: number;
    dismissed: number;
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  success: boolean;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        stats: {
          pending: 0,
          inReview: 0,
          resolved: 0,
          dismissed: 0,
          total: 0,
          byType: {},
          bySeverity: {},
        },
        success: false,
        error: "Not authenticated",
      };
    }

    const { data: reports, error } = await supabase.from("reports").select("status, report_type, severity");

    if (error) throw error;

    const stats = {
      pending: reports?.filter((r) => r.status === "pending").length || 0,
      inReview: reports?.filter((r) => r.status === "in_review").length || 0,
      resolved: reports?.filter((r) => r.status === "resolved").length || 0,
      dismissed: reports?.filter((r) => r.status === "dismissed").length || 0,
      total: reports?.length || 0,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    // Count by type
    reports?.forEach((r) => {
      stats.byType[r.report_type] = (stats.byType[r.report_type] || 0) + 1;
    });

    // Count by severity
    reports?.forEach((r) => {
      stats.bySeverity[r.severity] = (stats.bySeverity[r.severity] || 0) + 1;
    });

    return {
      stats,
      success: true,
    };
  } catch (error) {
    console.error("Error getting report stats:", error);
    return {
      stats: {
        pending: 0,
        inReview: 0,
        resolved: 0,
        dismissed: 0,
        total: 0,
        byType: {},
        bySeverity: {},
      },
      success: false,
      error: "Failed to load report statistics",
    };
  }
}
