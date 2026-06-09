// src/app/admin/tasks/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { AdminRoute } from "@/app/components/admin/AdminRoute";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@supabase/supabase-js";
import {
  getAdminTasks,
  createAdminTask,
  updateTaskStatus,
  toggleSubtask,
  claimTask,
  assignTask,
  requestTaskOwnership,
  duplicateTask,
  reorderTasks,
  editAdminTask,
  type AdminTask,
} from "@/app/actions/adminTaskActions";
import {
  CheckSquare, Plus, GripVertical, Link as LinkIcon, 
  UserPlus, Hand, Copy, Trash2, Clock, CheckCircle2, Circle, X, Edit
} from "lucide-react";

// Initialize standard Supabase client for fetching admin list
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TAG_COLORS: Record<string, string> = {
  Bug: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200",
  Feature: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
  Content: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200",
  Maintenance: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200",
  Urgent: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200",
};

export default function AdminTaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [admins, setAdmins] = useState<{id: string, display_name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"my_tasks" | "unassigned" | "active" | "completed">("active");

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [assignModalData, setAssignModalData] = useState<{isOpen: boolean, taskId: string, taskTitle: string}>({ isOpen: false, taskId: "", taskTitle: "" });
  
  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskLink, setNewTaskLink] = useState("");
  const [newTaskTag, setNewTaskTag] = useState("Feature");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newSubtasks, setNewSubtasks] = useState<string[]>([""]);

  // Edit Task Form
  const [editTaskData, setEditTaskData] = useState<{
    id: string;
    title: string;
    reference_link: string;
    tag: string;
    deadline: string;
    newSubtasks: string[];
  }>({ id: "", title: "", reference_link: "", tag: "Feature", deadline: "", newSubtasks: [] });

  useEffect(() => {
    loadTasks(true); // Initial load uses the full skeleton loader
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Custom sorting utility that automatically forces completed items to the bottom of the list
  const getSortedTasks = (taskList: AdminTask[]) => {
    return [...taskList].sort((a, b) => {
      // Completed items always drop to the absolute bottom of any active filter view
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      // Active items maintain their custom drag-and-drop order indexes
      return a.order_index - b.order_index;
    });
  };

  const loadTasks = async (showPulseLoader = false) => {
    if (showPulseLoader) setLoading(true);
    const includeArchived = filter === "completed";
    const res = await getAdminTasks(includeArchived);
    if (res.success && res.tasks) {
      let filtered = res.tasks;
      if (filter === "my_tasks") {
        filtered = res.tasks.filter(t => t.claimed_by === user?.id && t.status !== "archived");
      } else if (filter === "unassigned") {
        filtered = res.tasks.filter(t => !t.claimed_by && t.status !== "archived");
      } else if (filter === "completed") {
        filtered = res.tasks.filter(t => t.status === "completed");
      } else {
        filtered = res.tasks.filter(t => t.status !== "completed" && t.status !== "archived");
      }
      setTasks(getSortedTasks(filtered));
    }
    setLoading(false);
  };

  const loadAdmins = async () => {
    const { data } = await supabase.from('users').select('id, display_name').eq('is_admin', true);
    if (data) setAdmins(data);
  };

  // Optimistic state handler for main checkboxes.
  // Updates UI immediately, sorts dynamically, and makes the server call silent in the background.
  const handleToggleMainTaskStatus = async (task: AdminTask) => {
    // THE FIX: Enforce the strict union type cast here so TypeScript can compile safely! [1]
    const nextStatus = (task.status === 'completed' ? 'active' : 'completed') as 'active' | 'completed' | 'archived';

    // 1. Instantly update the local task list (reordering completed tasks to bottom)
    setTasks(prevTasks => {
        let updated = prevTasks.map(t => 
            t.id === task.id ? { ...t, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null } : t
        );
        // If we are looking at standard active tabs, re-sort so the completed item slides down smoothly
        if (filter !== "completed") {
            updated = getSortedTasks(updated);
        }
        return updated;
    });

    // 2. Safely process the Database update silently in the background
    const res = await updateTaskStatus(task.id, nextStatus, task.title);
    
    // 3. Silent re-sync just to align metadata without pulsing or resetting the scroll position!
    if (res.success) {
        loadTasks(false); 
    }
  };

  // Optimistic state handler for subtasks.
  // Instantly toggle the checked state locally, preventing full page re-renders.
  const handleToggleSubtaskItem = async (taskId: string, subtaskId: string, currentCompletedState: boolean) => {
    const nextCompletedState = !currentCompletedState;

    // 1. Instantly update the subtask checked state locally
    setTasks(prevTasks => 
        prevTasks.map(t => {
            if (t.id !== taskId) return t;
            const updatedSubtasks = t.subtasks?.map(sub => 
                sub.id === subtaskId ? { ...sub, is_completed: nextCompletedState } : sub
            );
            return { ...t, subtasks: updatedSubtasks };
        })
    );

    // 2. Update DB silently
    const res = await toggleSubtask(subtaskId, nextCompletedState);
    if (res.success) {
        loadTasks(false); // Silent background align
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const validSubtasks = newSubtasks.filter(st => st.trim() !== "");
    await createAdminTask({
      title: newTaskTitle,
      reference_link: newTaskLink,
      tag: newTaskTag,
      deadline: newTaskDeadline || undefined,
      subtaskTitles: validSubtasks
    });
    
    setIsCreateModalOpen(false);
    resetForm();
    loadTasks(true);
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTaskData.title.trim()) return;
    const validNewSubtasks = editTaskData.newSubtasks.filter(st => st.trim() !== "");
    await editAdminTask(editTaskData.id, {
      title: editTaskData.title,
      reference_link: editTaskData.reference_link || undefined,
      tag: editTaskData.tag || undefined,
      deadline: editTaskData.deadline || undefined,
      newSubtaskTitles: validNewSubtasks
    });
    setIsEditModalOpen(false);
    loadTasks(true);
  };

  const openEditModal = (task: AdminTask) => {
    setEditTaskData({
      id: task.id,
      title: task.title,
      reference_link: task.reference_link || "",
      tag: task.tag || "Feature",
      deadline: task.deadline ? task.deadline.split('T')[0] : "",
      newSubtasks: [] 
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setNewTaskTitle("");
    setNewTaskLink("");
    setNewTaskTag("Feature");
    setNewTaskDeadline("");
    setNewSubtasks([""]);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      const el = document.getElementById(`task-${id}`);
      if (el) el.style.opacity = "0.4";
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedTaskId === id) return;
    const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
    const targetIndex = tasks.findIndex(t => t.id === id);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Prevent dragging completed items above active ones to maintain sorting consistency
    if (tasks[draggedIndex].status === "completed" || tasks[targetIndex].status === "completed") return;

    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(targetIndex, 0, draggedTask);
    
    setTasks(newTasks);
  };

  const handleDragEnd = async () => {
    if (draggedTaskId) {
      const el = document.getElementById(`task-${draggedTaskId}`);
      if (el) el.style.opacity = "1";
    }
    setDraggedTaskId(null);
    const updates = tasks.map((t, index) => ({ id: t.id, order_index: index }));
    await reorderTasks(updates);
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  return (
    <AdminRoute>
      <div className="container max-w-5xl mx-auto px-4 py-8">
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <CheckSquare className="size-8 text-primary" />
              Admin Task Board
            </h1>
            <p className="text-muted-foreground mt-1">Track internal to-do items and site maintenance.</p>
          </div>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-primary/90 transition"
          >
            <Plus className="size-4" /> New Task
          </button>
        </div>

        {/* Smart Filters */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-4">
          {(["active", "my_tasks", "unassigned", "completed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f 
                  ? "bg-secondary text-foreground shadow-sm border border-border" 
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {f === "my_tasks" ? "My Tasks" : 
               f === "unassigned" ? "Unassigned" : 
               f === "active" ? "All Active" : "Completed"}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg text-muted-foreground">
              <CheckSquare className="size-12 mx-auto mb-3 opacity-20" />
              <p>No tasks found in this view.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                id={`task-${task.id}`}
                draggable={filter === "active" && task.status !== "completed"}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragEnd={handleDragEnd}
                className={`group bg-card border border-border rounded-lg p-4 shadow-sm transition-all ${
                  task.status === 'completed' ? 'opacity-60 bg-muted/30 border-border/60' : 'hover:border-primary/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Drag Handle */}
                  {filter === "active" && task.status !== "completed" ? (
                    <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="size-5" />
                    </div>
                  ) : (
                    // Reserve empty space for alignment so layout doesn't shift
                    filter === "active" && <div className="size-5 flex-shrink-0" />
                  )}

                  {/* Main Checkbox */}
                  <button 
                    onClick={() => handleToggleMainTaskStatus(task)}
                    className="mt-1 flex-shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="size-6 text-emerald-500" />
                    ) : (
                      <Circle className="size-6" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </h3>
                      {task.tag && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TAG_COLORS[task.tag] || TAG_COLORS['Maintenance']}`}>
                          {task.tag}
                        </span>
                      )}
                      {task.deadline && (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                          isOverdue(task.deadline) && task.status !== 'completed' 
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30' 
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}>
                          <Clock className="size-3" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {task.reference_link && (
                      <a href={task.reference_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-500 hover:underline mb-3">
                        <LinkIcon className="size-3" /> Reference Link
                      </a>
                    )}
                    
                    {/* Subtasks */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="mt-3 space-y-2 pl-2 border-l-2 border-border/50">
                        {task.subtasks.map(sub => (
                          <div key={sub.id} className="flex items-center gap-2 text-sm">
                            <button 
                              onClick={() => handleToggleSubtaskItem(task.id, sub.id, sub.is_completed)}
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              {sub.is_completed ? <CheckSquare className="size-4 text-primary" /> : <div className="size-4 border-2 border-muted-foreground rounded-sm" />}
                            </button>
                            <span className={sub.is_completed ? 'line-through text-muted-foreground' : ''}>{sub.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Actions & Claim Info */}
                  <div className="flex flex-col items-end gap-2 ml-4">
                    {task.claimed_by_user ? (
                      <div className="relative group/tooltip flex items-center gap-2 bg-secondary px-2 py-1 rounded-md text-xs font-medium border border-border cursor-default">
                        <img 
                          src={task.claimed_by_user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${task.claimed_by_user.display_name}`} 
                          alt="avatar" 
                          className="size-5 rounded-full bg-background"
                        />
                        <span className="truncate max-w-[80px]">{task.claimed_by_user.display_name.split(' ')[0]}</span>
                        
                        <div className="absolute bottom-full right-0 mb-2 w-max px-3 py-1.5 bg-foreground text-background text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-10">
                          Claimed by {task.claimed_by_user.display_name}
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={async () => { await claimTask(task.id); loadTasks(false); }}
                        className="text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Claim Task
                      </button>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 mt-2">
                      <button 
                        title="Edit Task"
                        onClick={() => openEditModal(task)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition"
                      >
                        <Edit className="size-4" />
                      </button>
                      <button 
                        title="Duplicate Task"
                        onClick={async () => { await duplicateTask(task.id); loadTasks(false); }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition"
                      >
                        <Copy className="size-4" />
                      </button>
                      
                      {!task.claimed_by ? (
                        <button 
                          title="Assign to..."
                          onClick={() => setAssignModalData({ isOpen: true, taskId: task.id, taskTitle: task.title })}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition"
                        >
                          <UserPlus className="size-4" />
                        </button>
                      ) : task.claimed_by !== user?.id ? (
                        <button 
                          title="Request Ownership"
                          onClick={async () => { await requestTaskOwnership(task.id, task.claimed_by!, task.title); alert("Request sent!"); }}
                          className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 rounded transition"
                        >
                          <Hand className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-xl rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Create New Task</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input required type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Fix the routing bug..." />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tag</label>
                  <select value={newTaskTag} onChange={e => setNewTaskTag(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {Object.keys(TAG_COLORS).map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deadline (Optional)</label>
                  <input type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference URL (Optional)</label>
                <input type="url" value={newTaskLink} onChange={e => setNewTaskLink(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subtasks (Checklist)</label>
                <div className="space-y-2">
                  {newSubtasks.map((st, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={st} onChange={e => {
                        const newArr = [...newSubtasks];
                        newArr[i] = e.target.value;
                        setNewSubtasks(newArr);
                      }} className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder={`Item ${i + 1}`} />
                      {newSubtasks.length > 1 && (
                        <button type="button" onClick={() => setNewSubtasks(newSubtasks.filter((_, idx) => idx !== i))} className="p-1.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewSubtasks([...newSubtasks, ""])} className="text-sm text-primary hover:underline flex items-center gap-1 mt-2">
                    <Plus className="size-3" /> Add Subtask
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-md hover:bg-secondary text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-xl rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Edit Task</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditTask} className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input required type="text" value={editTaskData.title} onChange={e => setEditTaskData({...editTaskData, title: e.target.value})} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tag</label>
                  <select value={editTaskData.tag} onChange={e => setEditTaskData({...editTaskData, tag: e.target.value})} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {Object.keys(TAG_COLORS).map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deadline (Optional)</label>
                  <input type="date" value={editTaskData.deadline} onChange={e => setEditTaskData({...editTaskData, deadline: e.target.value})} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference URL (Optional)</label>
                <input type="url" value={editTaskData.reference_link} onChange={e => setEditTaskData({...editTaskData, reference_link: e.target.value})} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Add New Subtasks</label>
                <div className="space-y-2">
                  {editTaskData.newSubtasks.map((st, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" value={st} onChange={e => {
                        const newArr = [...editTaskData.newSubtasks];
                        newArr[i] = e.target.value;
                        setEditTaskData({...editTaskData, newSubtasks: newArr});
                      }} className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder={`New Subtask ${i + 1}`} />
                      <button type="button" onClick={() => {
                        const newArr = editTaskData.newSubtasks.filter((_, idx) => idx !== i);
                        setEditTaskData({...editTaskData, newSubtasks: newArr});
                      }} className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setEditTaskData({...editTaskData, newSubtasks: [...editTaskData.newSubtasks, ""]})} className="text-sm text-primary hover:underline flex items-center gap-1 mt-2">
                    <Plus className="size-3" /> Add Subtask Field
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-md hover:bg-secondary text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assignModalData.isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border shadow-xl rounded-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Assign Task</h2>
              <button onClick={() => setAssignModalData({ isOpen: false, taskId: "", taskTitle: "" })} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-muted-foreground mb-4">Select an admin to assign to <strong>&quot;{assignModalData.taskTitle}&quot;</strong>:</p>
              {admins.map(admin => (
                <button
                  key={admin.id}
                  onClick={async () => {
                    await assignTask(assignModalData.taskId, admin.id, admin.display_name, assignModalData.taskTitle);
                    setAssignModalData({ isOpen: false, taskId: "", taskTitle: "" });
                    loadTasks(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-md border border-transparent hover:border-primary/50 hover:bg-primary/5 transition flex items-center justify-between group"
                >
                  <span className="font-medium">{admin.display_name}</span>
                  <UserPlus className="size-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminRoute>
  );
}
