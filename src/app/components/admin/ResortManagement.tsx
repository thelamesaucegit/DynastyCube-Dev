// src/app/components/admin/ResortManagement.tsx
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { Palmtree, Download, Loader2 } from "lucide-react";
import { importResortPoolFromScryfall } from "@/app/actions/resortAdminActions";

export function ResortManagement() {
    const [loading, setLoading] = useState(false);

    const handleImport = async () => {
        if (!confirm("This will fetch all qualifying lands from Scryfall and upsert them into the Resort Pool. Proceed?")) return;
        
        setLoading(true);
        const res = await importResortPoolFromScryfall();
        
        if (res.success) {
            toast.success(res.message);
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Palmtree className="size-5" />
                    Resort Pool Management
                </CardTitle>
                <CardDescription>
                    Import all qualifying non-basic lands from Scryfall. All imported cards are marked as &quot;hidden&quot; by default until the Season Rollover reveals 50 at random.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button 
                    onClick={handleImport} 
                    disabled={loading}
                    className="w-full sm:w-auto"
                >
                    {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                    {loading ? "Importing from Scryfall..." : "Import Resort Pool"}
                </Button>
            </CardContent>
        </Card>
    );
}
