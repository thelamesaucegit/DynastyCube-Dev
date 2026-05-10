// src/app/actions/adminTaskActions.ts

"use server";

import { createServerClient } from "@supabase/ssr";
import { SupabaseClient, createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// ============================================================================
// TYPES
// ============================================================================

export interface AdminSubtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
}

export interface AdminTask {
  id: string;
  title: string;
  reference_link: string | null;
  tag: string | null;
  status: 'active' | 'completed' | 'archived';
  order_index: number;
  created_by: string | null;
  claimed_by: string | null;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  subtasks?: AdminSubtask[];
  created_by_user?: { id: string; display_name: string; email: string } | null;
  claimed_by_user?: { id: string; display_name: string; email: string; avatar_url: string } | null;
}

// ============================================================================
// CLIENT, AUTH & ERROR HELPERS
// ============================================================================

// Standard client for fetching the user's session
async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Ignore */ }
        },
      },
    }
  );
}

// Service Role client for bypassing RLS after admin verification
function createServiceRoleClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Helper to safely parse Supabase JSON errors without using 'any'
function parseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.details === 'string') return errObj.details;
    return JSON.stringify(error);
  }
  return String(error);
}

// Ensures the calling user is authenticated and is an admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Unauthorized");

  // We use the service role here just in case RLS blocks selecting from users table as well
  const supabaseAdmin = createServiceRoleClient();
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('is_admin, display_name')
    .eq('id', user.id)
    .single();

  if (!userData?.is_admin) throw new Error("Forbidden: Admins only");
  
  return { user, display_name: userData.display_name };
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

async function notifyAllAdmins(supabaseAdmin: SupabaseClient, type: string, message: string, excludeUserId?: string) {
  const { data: admins } = await supabaseAdmin.from('users').select('id').eq('is_admin', true);
  if (!admins) return;

  const notificationsToInsert = admins
    .filter((admin: { id: string }) => admin.id !== excludeUserId)
    .map((admin: { id: string }) => ({
      user_id: admin.id,
      notification_type: type,
      message: message,
    }));

  if (notificationsToInsert.length > 0) {
    await supabaseAdmin.from('notifications').insert(notificationsToInsert);
  }
}

async function notifySingleUser(supabaseAdmin: SupabaseClient, userId: string, type: string, message: string) {
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    notification_type: type,
    message: message,
  });
}

// ============================================================================
// TASK ACTIONS
// ============================================================================

export async function getAdminTasks(includeArchived = false): Promise<{ success: boolean; tasks?: AdminTask[]; error?: string }> {
  try {
    await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    let query = supabaseAdmin
      .from('admin_tasks')
      .select(`
        *,
        subtasks:admin_subtasks(*),
        created_by_user:users!admin_tasks_created_by_fkey(id, display_name, email),
        claimed_by_user:users!admin_tasks_claimed_by_fkey(id, display_name, email, avatar_url)
      `)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.neq('status', 'archived');
    }

    const { data, error } = await query;

    if (error) throw error;

    // Subtasks need to be sorted locally or in the query. Local is safer for nested PostgREST arrays.
    const tasks = data?.map(task => ({
      ...task,
      subtasks: task.subtasks?.sort((a: AdminSubtask, b: AdminSubtask) => a.order_index - b.order_index)
    })) as AdminTask[];

    return { success: true, tasks };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    console.error("Error fetching admin tasks:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function createAdminTask(data: {
  title: string;
  reference_link?: string;
  tag?: string;
  deadline?: string;
  subtaskTitles?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, display_name } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    // 1. Insert Parent Task
    const { data: newTask, error: taskError } = await supabaseAdmin
      .from('admin_tasks')
      .insert({
        title: data.title,
        reference_link: data.reference_link || null,
        tag: data.tag || null,
        deadline: data.deadline || null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (taskError) throw taskError;

    // 2. Insert Subtasks if provided
    if (data.subtaskTitles && data.subtaskTitles.length > 0) {
      const subtasksToInsert = data.subtaskTitles.map((title, index) => ({
        task_id: newTask.id,
        title: title,
        order_index: index,
      }));
      await supabaseAdmin.from('admin_subtasks').insert(subtasksToInsert);
    }

    // 3. Notify Admins
    await notifyAllAdmins(
      supabaseAdmin, 
      'admin_task_created', 
      `${display_name || 'An admin'} created a new task: "${data.title}"`, 
      user.id
    );

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    console.error("Error creating admin task:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function updateTaskStatus(taskId: string, status: 'active' | 'completed' | 'archived', taskTitle: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, display_name } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    const updatePayload: { status: string; completed_at?: string | null } = { status };
    if (status === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
    } else {
      updatePayload.completed_at = null; // Reset if moving back to active
    }

    const { error } = await supabaseAdmin.from('admin_tasks').update(updatePayload).eq('id', taskId);
    if (error) throw error;

    // Notify if marked completed
    if (status === 'completed') {
      await notifyAllAdmins(
        supabaseAdmin, 
        'admin_task_completed', 
        `${display_name || 'An admin'} completed the task: "${taskTitle}"`, 
        user.id
      );
    }

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function toggleSubtask(subtaskId: string, isCompleted: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    const { error } = await supabaseAdmin.from('admin_subtasks').update({ is_completed: isCompleted }).eq('id', subtaskId);
    if (error) throw error;

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function claimTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    const { error } = await supabaseAdmin.from('admin_tasks').update({ claimed_by: user.id }).eq('id', taskId);
    if (error) throw error;

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function assignTask(taskId: string, assigneeId: string, assigneeName: string, taskTitle: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { display_name } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    const { error } = await supabaseAdmin.from('admin_tasks').update({ claimed_by: assigneeId }).eq('id', taskId);
    if (error) throw error;

    await notifySingleUser(
      supabaseAdmin,
      assigneeId,
      'admin_task_assigned',
      `${display_name || 'An admin'} assigned you to a task: "${taskTitle}"`
    );

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function requestTaskOwnership(taskId: string, currentOwnerId: string, taskTitle: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { display_name } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    await notifySingleUser(
      supabaseAdmin,
      currentOwnerId,
      'admin_task_ownership_request',
      `${display_name || 'Another admin'} is requesting to take over your task: "${taskTitle}". You can unassign yourself to let them claim it.`
    );

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function duplicateTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    // 1. Fetch original task & subtasks
    const { data: original, error: fetchError } = await supabaseAdmin
      .from('admin_tasks')
      .select('*, subtasks:admin_subtasks(*)')
      .eq('id', taskId)
      .single();

    if (fetchError || !original) throw new Error("Task not found");

    // 2. Insert Duplicate Task (stripping out specifics like completion status/claims)
    const { data: newTask, error: insertError } = await supabaseAdmin
      .from('admin_tasks')
      .insert({
        title: `${original.title} (Copy)`,
        reference_link: original.reference_link,
        tag: original.tag,
        created_by: user.id,
        // Intentionally leaving out claimed_by, deadline, completed_at
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // 3. Insert Duplicate Subtasks
    if (original.subtasks && original.subtasks.length > 0) {
      const subtasksToInsert = original.subtasks.map((st: AdminSubtask) => ({
        task_id: newTask.id,
        title: st.title,
        order_index: st.order_index,
        is_completed: false // Reset completion status
      }));
      await supabaseAdmin.from('admin_subtasks').insert(subtasksToInsert);
    }

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

export async function reorderTasks(taskUpdates: { id: string; order_index: number }[]): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabaseAdmin = createServiceRoleClient();

    // Perform a bulk update using an upsert or Promise.all. Promise.all is fine for small-scale admin boards.
    await Promise.all(
      taskUpdates.map((update) => 
        supabaseAdmin.from('admin_tasks').update({ order_index: update.order_index }).eq('id', update.id)
      )
    );

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = parseError(error);
    return { success: false, error: errorMessage };
  }
}

