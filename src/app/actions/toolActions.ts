// src/app/actions/toolActions.ts
"use server";

import { decompress } from "lzma1";

/**
 * Decompresses an LZMA-compressed base64 string using the 'lzma1' library.
 * Returns the decompressed data as a base64 string.
 */
export async function decompress_lzma_replay(base64Data: string): Promise<string | null> {
    try {
        console.log("[Tool Actions] Starting LZMA decompression with 'lzma1'...");
        
        // 1. Convert the base64 string from the client into a Node.js Buffer.
        //    A Buffer is a Uint8Array, which is what the library expects.
        const compressedBuffer = Buffer.from(base64Data, "base64");
        
        // 2. Decompress the buffer synchronously.
        const decompressedUint8Array = decompress(compressedBuffer);
        
        // 3. Convert the resulting Uint8Array back into a Buffer and then to a base64 string.
        const resultBase64 = Buffer.from(decompressedUint8Array).toString("base64");

        console.log("[Tool Actions] ✅ Decompression successful!");
        
        return resultBase64;

    } catch (error) {
        console.error("[Tool Actions] ❌ Unexpected error during decompression:", error);
        // If the file wasn't compressed, lzma1 might throw an error. 
        // We can add a fallback if needed, but for now, we'll let the error surface.
        return null;
    }
}
