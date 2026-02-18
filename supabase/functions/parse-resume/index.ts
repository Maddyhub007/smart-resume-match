import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── PDF Text Extraction ────────────────────────────────────────────────────

/**
 * Decompress a zlib-encoded (FlateDecode) stream using Deno's native
 * DecompressionStream API. PDFs use zlib which is "deflate" format.
 */
async function zlibDecompress(data: Uint8Array): Promise<Uint8Array> {
  // Try zlib wrapper first (deflate), then raw deflate as fallback
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(data);
      writer.close();

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      if (out.length > 0) return out;
    } catch (_) { /* try next format */ }
  }
  return data; // return original if decompression fails
}

/**
 * Extract human-readable text from a raw PDF byte array.
 * Handles both uncompressed and FlateDecode-compressed content streams.
 */
async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1");
  const utf8 = new TextDecoder("utf-8", { fatal: false });
  const raw = latin1.decode(bytes);

  const textChunks: string[] = [];

  // ── Step 1: Find all stream ... endstream blocks ──────────────────────────
  const streamRegex = /<<([\s\S]{1,2000}?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  const streamPromises: Promise<void>[] = [];

  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    const dictPart = streamMatch[1];
    const streamStart = streamMatch.index + streamMatch[0].indexOf("stream") + 6;
    // Find actual byte offset for binary stream data
    const streamEnd = raw.indexOf("\nendstream", streamStart);
    if (streamEnd === -1) continue;

    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictPart) ||
      /\/Filter\s*\[[\s\S]*?\/FlateDecode[\s\S]*?\]/.test(dictPart);

    // Capture raw bytes of this stream
    const startByte = streamStart + 1; // skip the \n after "stream"
    const endByte = streamEnd;

    const capturedStart = startByte;
    const capturedEnd = endByte;

    streamPromises.push((async () => {
      let streamBytes = bytes.slice(capturedStart, capturedEnd);

      if (isFlate) {
        try {
          streamBytes = await zlibDecompress(streamBytes);
        } catch (_) { return; }
      }

      // Decode decompressed stream as UTF-8
      const decoded = utf8.decode(streamBytes);

      // Extract text operators from PDF content streams
      const btEtRegex = /BT([\s\S]*?)ET/g;
      let btMatch: RegExpExecArray | null;
      while ((btMatch = btEtRegex.exec(decoded)) !== null) {
        const block = btMatch[1];

        // TJ arrays: [(text) spacing (text)] TJ
        const tjArrRegex = /\[((?:\([^)]*\)|<[^>]*>|[-\d.\s]+)*)\]\s*TJ/gi;
        let arr: RegExpExecArray | null;
        while ((arr = tjArrRegex.exec(block)) !== null) {
          const inner = arr[1];
          const strParts = /\(([^)]*)\)/g;
          let sp: RegExpExecArray | null;
          while ((sp = strParts.exec(inner)) !== null) {
            const t = sp[1].replace(/\\n/g, " ").replace(/\\r/g, " ")
              .replace(/\\t/g, " ").replace(/\\\\/g, "\\")
              .replace(/\\([()])/g, "$1");
            if (t.trim()) textChunks.push(t);
          }
          // Hex strings in TJ arrays
          const hexParts = /<([^>]+)>/g;
          let hp: RegExpExecArray | null;
          while ((hp = hexParts.exec(inner)) !== null) {
            const hex = hp[1].replace(/\s/g, "");
            let hexText = "";
            for (let i = 0; i < hex.length; i += 4) {
              const code = parseInt(hex.slice(i, i + 4), 16);
              if (code > 31 && code < 65535) hexText += String.fromCharCode(code);
            }
            if (hexText.trim()) textChunks.push(hexText);
          }
        }

        // Single Tj: (text) Tj
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let tj: RegExpExecArray | null;
        while ((tj = tjRegex.exec(block)) !== null) {
          const t = tj[1].replace(/\\n/g, " ").replace(/\\r/g, " ")
            .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1");
          if (t.trim()) textChunks.push(t);
        }

        // Hex Tj: <hex> Tj
        const hexTjRegex = /<([^>]+)>\s*Tj/g;
        let htj: RegExpExecArray | null;
        while ((htj = hexTjRegex.exec(block)) !== null) {
          const hex = htj[1].replace(/\s/g, "");
          let hexText = "";
          for (let i = 0; i < hex.length; i += 4) {
            const code = parseInt(hex.slice(i, i + 4), 16);
            if (code > 31 && code < 65535) hexText += String.fromCharCode(code);
          }
          if (hexText.trim()) textChunks.push(hexText);
        }

        // Td/TD/T* operators signal new lines - add space
        if (/T[dD*]/.test(block)) textChunks.push(" ");
      }

      // Also grab plain readable text from non-content streams (e.g., metadata)
      const printable = decoded.match(/[\x20-\x7E\n\r\t]{4,}/g);
      if (printable && !isFlate) {
        // Only from uncompressed metadata streams to avoid noise
        const meta = printable.filter(s =>
          !s.startsWith("/") && !/^[\d\s.]+$/.test(s) &&
          !/^(obj|stream|xref|trailer)$/i.test(s.trim())
        ).join(" ");
        if (meta.length > 20) textChunks.push(meta);
      }
    })());
  }

  await Promise.all(streamPromises);

  let text = textChunks.join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // split camelCase
    .trim();

  console.log(`Extracted text length after full parse: ${text.length}`);
  console.log(`Text preview: ${text.substring(0, 300)}`);

  // ── Step 2: If still very little text, try UTF-8 printable fallback ───────
  if (text.length < 200) {
    console.log("Trying UTF-8 printable ASCII fallback...");
    const decoded = utf8.decode(bytes);
    const runs = decoded.match(/[a-zA-Z][a-zA-Z0-9\s@.,:()\-+/]{3,}/g) || [];
    const filtered = runs
      .filter(s => s.split(" ").length >= 2) // at least 2 words
      .filter(s => !/^(obj|endobj|stream|endstream|xref|trailer|startxref|FlateDecode|Filter|Font|Page)$/i.test(s.trim()))
      .filter(s => !/^\d+\s+\d+\s+R$/.test(s.trim())); // skip PDF references
    const fallback = filtered.join(" ").replace(/\s+/g, " ").trim();
    if (fallback.length > text.length) text = fallback;
    console.log(`Fallback text length: ${text.length}`);
  }

  return text;
}

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const buf = await fileData.arrayBuffer();
    return await extractTextFromPdfBytes(new Uint8Array(buf));
  }
  return await fileData.text();
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { resumeId, fileName } = await req.json();

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(fileName);

    if (downloadError) throw new Error("Failed to download resume: " + downloadError.message);

    const text = await extractText(fileData, fileName);
    console.log("Final extracted text length:", text.length);

    if (!text || text.trim().length < 50) {
      throw new Error(
        "Could not extract readable text from this file. " +
        "This PDF may be image-based (scanned). Please use a text-based PDF or a DOCX file."
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI key not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert resume parser. Your job is to extract EXACT information from resume text.

CRITICAL RULES:
1. ONLY use information explicitly present in the text below. NEVER fabricate or guess.
2. Extract the FULL NAME from the very beginning of the resume.
3. Extract email, phone, location EXACTLY as written.
4. Extract ALL work experience entries with exact job title, company name, and date range.
5. Extract ALL education entries with exact degree name, institution, and year.
6. Extract every skill mentioned (technical tools, frameworks, languages, soft skills).
7. Write a concise 2-3 sentence professional summary based ONLY on actual content.
8. Score the resume 0-100 based on completeness (presence of all sections) and experience quality.
9. If any field is missing from the resume, return null (not a placeholder string).
10. The text may have concatenated words due to PDF extraction - use context to split them.`,
          },
          {
            role: "user",
            content: `Parse this resume and extract all information accurately:\n\n${text.substring(0, 18000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_resume",
              description: "Extract structured resume data accurately from the provided text.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name of the candidate" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" },
                  location: { type: "string", description: "City, State or Country" },
                  summary: { type: "string", description: "Professional summary (2-3 sentences)" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "All skills: technical, tools, languages, soft skills",
                  },
                  experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Exact job title" },
                        company: { type: "string", description: "Exact company name" },
                        duration: { type: "string", description: "Date range e.g. Jan 2020 – Mar 2022" },
                      },
                      required: ["title", "company", "duration"],
                    },
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string", description: "Exact degree name" },
                        institution: { type: "string", description: "Exact institution name" },
                        year: { type: "string", description: "Graduation year or date range" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                  },
                  overall_score: {
                    type: "number",
                    description: "Resume quality score 0-100",
                  },
                },
                required: ["name", "skills", "experience", "education", "overall_score"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_resume" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI parsing failed: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response from AI");

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log("Parsed result:", JSON.stringify(parsed, null, 2));

    // Update resume record using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await serviceClient
      .from("resumes")
      .update({
        parsed_name: parsed.name || null,
        parsed_email: parsed.email || null,
        parsed_phone: parsed.phone || null,
        parsed_location: parsed.location || null,
        parsed_summary: parsed.summary || null,
        parsed_skills: parsed.skills || [],
        parsed_experience: parsed.experience || [],
        parsed_education: parsed.education || [],
        overall_score: parsed.overall_score || 0,
      })
      .eq("id", resumeId);

    if (updateError) throw new Error("Failed to update resume: " + updateError.message);

    return new Response(JSON.stringify({ success: true, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-resume error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
