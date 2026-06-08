// src/app/components/admin/CypherManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { toast } from "sonner";
import { getAdminCyphers, saveCypher } from "@/app/actions/cypherActions";

// --- STRICT INTERFACE ---
export interface AdminCypher {
    id: string;
    title: string;
    content: string;
    is_published: boolean;
    created_at?: string;
    created_by?: string;
}

export function CypherManagement() {
  const [cyphers, setCyphers] = useState<AdminCypher[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const load = async () => {
      const res = await getAdminCyphers();
      if (res.success && res.cyphers) {
          // Cast the DB response to our strict interface
          setCyphers(res.cyphers as AdminCypher[]);
      }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
      const res = await saveCypher(editingId, title, content, isPublished);
      if (res.success) {
          toast.success("Cypher saved!");
          setEditingId(null); 
          setTitle(""); 
          setContent(""); 
          setIsPublished(false);
          load();
      } else {
          toast.error(res.error);
      }
  };

  const handleEdit = (c: AdminCypher) => {
      setEditingId(c.id); 
      setTitle(c.title); 
      setContent(c.content); 
      setIsPublished(c.is_published);
  };

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>The Cypher Management</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        
        <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
            <Input 
                placeholder="Cypher Title" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
            />
            <textarea 
                className="w-full h-32 p-3 rounded-md border bg-background" 
                placeholder="The secret text goes here..." 
                value={content} 
                onChange={e => setContent(e.target.value)} 
            />
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={isPublished} 
                        onChange={e => setIsPublished(e.target.checked)} 
                    />
                    Publish to players
                </label>
                <div className="space-x-2">
                    {editingId && (
                        <Button 
                            variant="ghost" 
                            onClick={() => { setEditingId(null); setTitle(""); setContent(""); }}
                        >
                            Cancel
                        </Button>
                    )}
                    <Button onClick={handleSave}>Save Cypher</Button>
                </div>
            </div>
        </div>

        <div className="space-y-2 mt-6">
            {cyphers.map(c => (
                <div key={c.id} className="flex justify-between p-3 border rounded items-center">
                    <div>
                        <span className="font-bold">{c.title}</span>
                        <span className={`ml-3 text-xs ${c.is_published ? 'text-green-500' : 'text-orange-500'}`}>
                            {c.is_published ? 'Published' : 'Draft'}
                        </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>Edit</Button>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
