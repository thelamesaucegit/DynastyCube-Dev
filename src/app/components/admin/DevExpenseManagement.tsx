//// src/app/components/admin/DevExpenseManagement.tsx

"use client";

import React, { useState, useEffect } from "react";
import { getDevExpenses, upsertDevExpense, type DevExpense, type CustomCost } from "@/app/actions/devExpenseActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Loader2, Plus, Trash2, Save, Calculator } from "lucide-react";

export const DevExpenseManagement: React.FC = () => {
  const [expenses, setExpenses] = useState<DevExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [newMonthStr, setNewMonthStr] = useState("");

  useEffect(() => {
    const now = new Date();
    setNewMonthStr(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { expenses: data, error } = await getDevExpenses();
    if (error) setMessage({ type: "error", text: error });
    else setExpenses(data);
    setLoading(false);
  };

  const handleCreateMonth = async () => {
    if (!newMonthStr) return;
    setSaving("new");
    const result = await upsertDevExpense(`${newMonthStr}-01`, {
      dev_hours: 0,
      hourly_rate: 15.00,
      hosting_cost: 39.10,
      dev_paid: 0,
      raised_amount: 0,
      site_revenue: 0,
      custom_costs: []
    });

    if (result.success) {
      setMessage({ type: "success", text: "New month created!" });
      await loadData();
    } else {
      setMessage({ type: "error", text: result.error || "Failed to create month" });
    }
    setSaving(null);
  };

  const handleUpdateField = <K extends keyof DevExpense>(month: string, field: K, value: DevExpense[K]) => {
    setExpenses(prev => prev.map(exp => exp.expense_month === month ? { ...exp, [field]: value } : exp));
  };

  const handleSaveMonth = async (expense: DevExpense) => {
    setSaving(expense.expense_month);
    const result = await upsertDevExpense(expense.expense_month, {
      dev_hours: expense.dev_hours,
      hourly_rate: expense.hourly_rate,
      hosting_cost: expense.hosting_cost,
      dev_paid: expense.dev_paid,
      raised_amount: expense.raised_amount,
      site_revenue: expense.site_revenue,
      custom_costs: expense.custom_costs,
    });

    if (result.success) {
      setMessage({ type: "success", text: "Saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: "error", text: result.error || "Failed to save" });
    }
    setSaving(null);
  };

  const addCustomCost = (month: string) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.expense_month !== month) return exp;
      const newCost: CustomCost = { id: crypto.randomUUID(), description: "", amount: 0 };
      return { ...exp, custom_costs: [...exp.custom_costs, newCost] };
    }));
  };

  const updateCustomCost = (month: string, costId: string, field: keyof CustomCost, value: string | number) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.expense_month !== month) return exp;
      return {
        ...exp,
        custom_costs: exp.custom_costs.map(c => c.id === costId ? { ...c, [field]: value } : c)
      };
    }));
  };

  const removeCustomCost = (month: string, costId: string) => {
    setExpenses(prev => prev.map(exp => {
      if (exp.expense_month !== month) return exp;
      return { ...exp, custom_costs: exp.custom_costs.filter(c => c.id !== costId) };
    }));
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" />
        <p className="text-muted-foreground">Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
            <Calculator className="size-5" /> Dev Expenses & Running Costs
          </h2>
          <p className="text-sm text-muted-foreground">Track monthly development hours, hosting fees, and fundraising.</p>
        </div>
        <div className="flex gap-2">
          <Input 
            type="month" 
            value={newMonthStr} 
            onChange={(e) => setNewMonthStr(e.target.value)} 
            className="w-40"
          />
          <Button onClick={handleCreateMonth} disabled={saving === "new"}>
            {saving === "new" ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
            Add Month
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${message.type === "success" ? "bg-green-50 border-green-300 text-green-800" : "bg-red-50 border-red-300 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {expenses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No expenses recorded yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {expenses.map((expense) => {
            const dateObj = new Date(expense.expense_month);
            const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            
            const customTotal = expense.custom_costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
            const devTotalOwed = expense.dev_hours * expense.hourly_rate;
            const devRemainingBalance = devTotalOwed - expense.dev_paid;
            const grandTotal = devTotalOwed + expense.hosting_cost + customTotal;

            return (
              <Card key={expense.expense_month} className="border-border shadow-md">
                <CardHeader className="bg-muted/50 pb-4 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">{monthLabel}</CardTitle>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Monthly Burden</p>
                      <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrency(grandTotal)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  
                  {/* Row 1: Site Expenses & Revenue */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Hosting ($)</label>
                      <Input type="number" min="0" step="0.01" value={expense.hosting_cost} onChange={(e) => handleUpdateField(expense.expense_month, "hosting_cost", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-emerald-600 mb-1">Site Revenue ($)</label>
                      <Input type="number" min="0" step="0.01" value={expense.site_revenue} onChange={(e) => handleUpdateField(expense.expense_month, "site_revenue", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-emerald-600 mb-1">Patreon/Kofi ($)</label>
                      <Input type="number" min="0" step="0.01" value={expense.raised_amount} onChange={(e) => handleUpdateField(expense.expense_month, "raised_amount", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>

                  {/* Row 2: Dev Ledger */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-3">Amonte&apos;s Dev Ledger</h4>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Hours Logged</label>
                        <Input type="number" min="0" step="0.5" value={expense.dev_hours} onChange={(e) => handleUpdateField(expense.expense_month, "dev_hours", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Rate ($/hr)</label>
                        <Input type="number" min="0" step="1" value={expense.hourly_rate} onChange={(e) => handleUpdateField(expense.expense_month, "hourly_rate", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-emerald-600 mb-1">Dev Paid ($)</label>
                        <Input type="number" min="0" step="0.01" value={expense.dev_paid} onChange={(e) => handleUpdateField(expense.expense_month, "dev_paid", parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-3 border-t border-blue-200 dark:border-blue-800">
                      <span className="text-blue-800 dark:text-blue-300 font-medium">Unpaid Dev Balance (This Month):</span>
                      <span className={`font-bold ${devRemainingBalance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{formatCurrency(devRemainingBalance)}</span>
                    </div>
                  </div>

                  {/* Custom Costs */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold">Custom / One-Time Costs</label>
                      <Button variant="outline" size="sm" onClick={() => addCustomCost(expense.expense_month)}>
                        <Plus className="size-3 mr-1" /> Add Cost
                      </Button>
                    </div>
                    {expense.custom_costs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">No custom costs for this month.</p>
                    ) : (
                      <div className="space-y-2">
                        {expense.custom_costs.map((cost) => (
                          <div key={cost.id} className="flex items-center gap-2">
                            <Input placeholder="Description (e.g. Domain Renewal)" value={cost.description} onChange={(e) => updateCustomCost(expense.expense_month, cost.id, "description", e.target.value)} className="flex-1" />
                            <Input type="number" placeholder="Amount" value={cost.amount} onChange={(e) => updateCustomCost(expense.expense_month, cost.id, "amount", parseFloat(e.target.value) || 0)} className="w-28" />
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeCustomCost(expense.expense_month, cost.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button onClick={() => handleSaveMonth(expense)} disabled={saving === expense.expense_month} className="w-full sm:w-auto">
                      {saving === expense.expense_month ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                      Save {monthLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
