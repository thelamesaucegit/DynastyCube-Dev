// src/app/tesseract/create/page.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createTesseractDraft } from "@/app/actions/tesseractSessionActions";

export default function CreateTesseractDraftPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [passcode, setPasscode] = useState("");
    const [draftFormat, setDraftFormat] = useState<"snake" | "linear">("snake");
    const [totalRounds, setTotalRounds] = useState<number>(40);
    const [hoursPerPick, setHoursPerPick] = useState<number>(1);
    const [maxPlayers, setMaxPlayers] = useState<number>(8);
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [csvData, setCsvData] = useState<string>("");
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setCsvData("");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
            if (typeof event.target?.result === "string") {
                setCsvData(event.target.result);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the uploaded file.");
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return setError("Draft name is required.");
        if (!startDate || !startTime) return setError("Start date and time are required.");
        if (!csvData) return setError("Please upload a Cube Cobra CSV file.");
        if (totalRounds < 1) return setError("Total rounds must be at least 1.");
        if (hoursPerPick <= 0) return setError("Hours per pick must be greater than 0.");
        if (maxPlayers < 2) return setError("Draft must have at least 2 players.");

        setLoading(true);

        try {
            const startISO = new Date(`${startDate}T${startTime}`).toISOString();

            const result = await createTesseractDraft({
                name: name.trim(),
                passcode: passcode.trim() || undefined,
                draftFormat,
                totalRounds,
                hoursPerPick,
                maxPlayers,
                startTime: startISO,
                csvData
            });

            if (result.success && result.sessionId) {
                router.push(`/tesseract/${result.sessionId}/join`);
            } else {
                setError(result.error || "Failed to create draft session.");
                setLoading(false);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "An unexpected error occurred.";
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 mt-8 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <h1 className="text-3xl font-bold mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
                Create Tesseract Draft
            </h1>
            
            {error && (
                <div className="mb-6 p-4 bg-red-100 text-red-900 border border-red-300">
                    <strong>Error:</strong> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* General Settings */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold">General Settings</h2>
                    
                    <div>
                        <label className="block font-bold mb-1">Draft Name *</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full border border-gray-400 p-2 bg-transparent"
                            placeholder="Enter draft name"
                            required
                        />
                    </div>

                    <div>
                        <label className="block font-bold mb-1">Passcode (Optional)</label>
                        <input 
                            type="text" 
                            value={passcode} 
                            onChange={(e) => setPasscode(e.target.value)} 
                            className="w-full border border-gray-400 p-2 bg-transparent"
                            placeholder="Leave blank for a public lobby"
                        />
                    </div>
                </div>

                {/* Draft Rules */}
                <div className="space-y-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <h2 className="text-xl font-bold">Draft Rules</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block font-bold mb-1">Format *</label>
                            <select 
                                value={draftFormat} 
                                onChange={(e) => setDraftFormat(e.target.value as "snake" | "linear")}
                                className="w-full border border-gray-400 p-2 bg-transparent"
                            >
                                <option value="snake">Snake</option>
                                <option value="linear">Linear</option>
                            </select>
                        </div>
                        <div>
                            <label className="block font-bold mb-1">Max Players *</label>
                            <input 
                                type="number" 
                                min="2"
                                max="32"
                                value={maxPlayers} 
                                onChange={(e) => setMaxPlayers(Number(e.target.value))} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-bold mb-1">Total Rounds *</label>
                            <input 
                                type="number" 
                                min="1"
                                value={totalRounds} 
                                onChange={(e) => setTotalRounds(Number(e.target.value))} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-bold mb-1">Hours / Pick *</label>
                            <input 
                                type="number" 
                                step="0.5"
                                min="0.5"
                                value={hoursPerPick} 
                                onChange={(e) => setHoursPerPick(Number(e.target.value))} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Scheduling */}
                <div className="space-y-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <h2 className="text-xl font-bold">Scheduling</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold mb-1">Start Date *</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-bold mb-1">Start Time *</label>
                            <input 
                                type="time" 
                                value={startTime} 
                                onChange={(e) => setStartTime(e.target.value)} 
                                className="w-full border border-gray-400 p-2 bg-transparent"
                                required
                            />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Drafts enforce a strict maximum lifespan of 1 week from the start time.
                    </p>
                </div>

                {/* Data Upload */}
                <div className="space-y-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                    <h2 className="text-xl font-bold">Card Pool</h2>
                    
                    <div>
                        <label className="block font-bold mb-1">Upload Cube Cobra CSV *</label>
                        <input 
                            type="file" 
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="w-full border border-gray-400 p-2 bg-transparent"
                            required
                        />
                    </div>
                </div>

                {/* Submit */}
                <div className="pt-6">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-700 text-white font-bold p-3 hover:bg-blue-800 disabled:bg-gray-500 transition-colors"
                    >
                        {loading ? "Creating Draft Session..." : "Create Tesseract Draft"}
                    </button>
                </div>
            </form>
        </div>
    );
}
