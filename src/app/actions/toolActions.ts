// src/app/actions/toolActions.ts
"use server";

// We use require because 'lzma' doesn't have official TypeScript definitions
// Make sure you ran: npm install lzma
const lzma = require("lzma");

/**
 * Decompresses an LZMA-compressed base64 string.
 * Returns the decompressed data as a base64 string.
 */
export async function decompress_lzma_replay(base64Data: string): Promise<string | null> {
    try {
        console.log("[Tool Actions] Starting LZMA decompression...");
        
        // Convert the base64 string from the client into a Node.js Buffer
        const compressedBuffer = Buffer.from(base64Data, "base64");
        
        return new Promise((resolve) => {
            // The lzma library uses a callback structure for decompression
            lzma.decompress(compressedBuffer, (result: number[] | string | null, error: Error | null) => {
                if (error) {
                    console.error("[Tool Actions] ❌ LZMA Decompression Error:", error);
                    // If decompression fails (e.g., the file wasn't actually compressed),
                    // fallback to returning the original data just in case.
                    resolve(base64Data);
                } else if (result) {
                    console.log("[Tool Actions] ✅ Decompression successful!");
                    
                    // Convert the decompressed array/string back into a Buffer, then to base64
                    let decompressedBuffer: Buffer;
                    if (typeof result === "string") {
                        decompressedBuffer = Buffer.from(result, "utf8");
                    } else {
                        decompressedBuffer = Buffer.from(result);
                    }
                    
                    resolve(decompressedBuffer.toString("base64"));
                } else {
                    console.error("[Tool Actions] ❌ Decompression returned null result.");
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error("[Tool Actions] ❌ Unexpected error during decompression:", error);
        return null;
    }
}
