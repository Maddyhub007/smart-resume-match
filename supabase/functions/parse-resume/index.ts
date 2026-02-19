import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Decompress FlateDecode streams ─────────────────────────────────────────

async function zlibDecompress(data: Uint8Array): Promise<Uint8Array | null> {
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
      if (out.length > 10) return out;
    } catch (_) { /* try next */ }
  }
  return null;
}

// ─── Decode hex PDF strings ──────────────────────────────────────────────────

function hexToText(hex: string): string {
  const h = hex.replace(/\s/g, "");
  if (h.length % 2 !== 0 && h.length % 4 !== 0) return "";

  // Try 2-byte (UTF-16 BE) first for wide chars
  if (h.length >= 4 && h.length % 4 === 0) {
    let text = "";
    let isWide = false;
    for (let i = 0; i < h.length; i += 4) {
      const code = parseInt(h.slice(i, i + 4), 16);
      if (code > 31 && code < 65535) { text += String.fromCharCode(code); isWide = true; }
    }
    if (isWide && text.trim()) return text;
  }

  // Fall back to 1-byte
  let text = "";
  for (let i = 0; i < h.length; i += 2) {
    const code = parseInt(h.slice(i, i + 2), 16);
    if (code > 31 && code < 128) text += String.fromCharCode(code);
  }
  return text;
}

// ─── PDF literal string decoder ─────────────────────────────────────────────

function decodeLiteral(s: string): string {
  return s
    .replace(/\\n/g, " ").replace(/\\r/g, " ").replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// ─── Extract text from a decoded content-stream string ───────────────────────

function extractFromContentStream(decoded: string): string[] {
  const chunks: string[] = [];

  const btBlocks = [...decoded.matchAll(/BT([\s\S]*?)ET/g)];
  for (const btMatch of btBlocks) {
    const block = btMatch[1];
    let hasNewline = false;

    // Td / TD / T* / Tm introduce newlines
    if (/T[dDm*]/.test(block)) hasNewline = true;

    // TJ array: [ (text) n (text) <hex> ... ] TJ
    for (const arr of block.matchAll(/\[([\s\S]*?)\]\s*TJ/gi)) {
      const inner = arr[1];
      for (const sp of inner.matchAll(/\(([^)]*)\)/g)) {
        const t = decodeLiteral(sp[1]);
        if (t.trim()) chunks.push(t);
      }
      for (const hp of inner.matchAll(/<([0-9a-fA-F\s]+)>/g)) {
        const t = hexToText(hp[1]);
        if (t.trim()) chunks.push(t);
      }
    }

    // Single Tj
    for (const tj of block.matchAll(/\(([^)]*)\)\s*Tj/g)) {
      const t = decodeLiteral(tj[1]);
      if (t.trim()) chunks.push(t);
    }

    // Hex Tj
    for (const htj of block.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)) {
      const t = hexToText(htj[1]);
      if (t.trim()) chunks.push(t);
    }

    if (hasNewline) chunks.push(" ");
  }

  return chunks;
}

// ─── Main PDF text extractor ─────────────────────────────────────────────────

async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1");
  const utf8 = new TextDecoder("utf-8", { fatal: false });

  // We'll process streams lazily to avoid huge allocations
  const raw = latin1.decode(bytes);

  const allChunks: string[] = [];

  // Find all stream/endstream pairs
  const streamRegex = /<<([\s\S]{1,3000}?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = streamRegex.exec(raw)) !== null) {
    const dictPart = m[1];
    const streamDataStart = m.index + m[0].length;

    // Find endstream
    const endIdx = raw.indexOf("endstream", streamDataStart);
    if (endIdx === -1) continue;

    // Skip non-content streams (images, fonts, etc.)
    const isContent = /\/Filter|\/Length/.test(dictPart);
    if (!isContent) continue;

    // Skip streams that are clearly images
    if (/\/Subtype\s*\/Image/.test(dictPart)) continue;

    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictPart) ||
      /\/Filter\s*\[[\s\S]*?FlateDecode[\s\S]*?\]/.test(dictPart);

    const isNoFilter = !/\/Filter/.test(dictPart);

    // Strip trailing \r from end marker
    const endByte = endIdx;
    let streamBytes = bytes.slice(streamDataStart, endByte);
    // Remove trailing \r\n
    if (streamBytes[streamBytes.length - 1] === 10) streamBytes = streamBytes.slice(0, -1);
    if (streamBytes[streamBytes.length - 1] === 13) streamBytes = streamBytes.slice(0, -1);

    let decoded: string;
    if (isFlate) {
      const decompressed = await zlibDecompress(streamBytes);
      if (!decompressed) continue;
      decoded = utf8.decode(decompressed);
    } else if (isNoFilter) {
      decoded = utf8.decode(streamBytes);
    } else {
      continue; // skip other encodings (JBIG2, CCITTFax, etc.)
    }

    const chunks = extractFromContentStream(decoded);
    allChunks.push(...chunks);
  }

  // Join with smart spacing
  let text = allChunks
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")   // split camelCase words
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")    // split letter-number glue
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")    // split number-letter glue
    .trim();

  console.log(`Extracted text length: ${text.length}`);
  console.log(`Preview: ${text.substring(0, 500)}`);

  // ── Fallback: if still short, use printable-run heuristic ────────────────
  if (text.length < 300) {
    console.log("Short extraction, trying UTF-8 printable fallback...");
    const full = utf8.decode(bytes);
    const runs = full.match(/[a-zA-Z][a-zA-Z0-9@.,:()\-+/\s]{3,}/g) || [];
    const fallback = runs
      .filter((s) => s.split(/\s+/).length >= 2)
      .filter((s) => !/^(obj|endobj|stream|endstream|xref|trailer|startxref|FlateDecode|Filter|Font|Page|Encoding|Resources)$/i.test(s.trim()))
      .filter((s) => !/^\d+\s+\d+\s+R$/.test(s.trim()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (fallback.length > text.length) {
      console.log(`Fallback produced better text (${fallback.length} chars)`);
      text = fallback;
    }
  }

  return text;
}

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const buf = await fileData.arrayBuffer();
    return extractTextFromPdfBytes(new Uint8Array(buf));
  }
  // For DOCX / TXT just return as-is
  return fileData.text();
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
    console.log("Final text length:", text.length);

    if (!text || text.trim().length < 50) {
      throw new Error(
        "Could not extract readable text from this file. " +
        "The PDF may be image-based (scanned). Please use a text-based PDF or DOCX file."
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI key not configured");

    const systemPrompt = `You are a world-class resume parser with 15+ years of experience in HR and ATS systems.

Your task: extract EVERY piece of information from the resume text below with 100% accuracy.

STRICT RULES:
1. ONLY use information EXPLICITLY present in the text. NEVER fabricate, hallucinate, or guess ANY data.
2. If a field is missing from the resume, return null (NOT a placeholder like "John Doe", "example@email.com", etc.)
3. The text may have garbled spacing from PDF extraction — use context to intelligently re-join words.
4. Extract the FULL NAME from the very top of the resume (usually the largest/first text element).
5. Extract email exactly as written (look for @ symbol patterns).
6. Extract phone exactly as written (look for digit patterns 10+ digits, with optional dashes/spaces).
7. Extract ALL skills: programming languages, frameworks, tools, certifications, soft skills — everything.
8. For each experience entry, extract: exact job title, exact company name, and exact date range.
9. For each education entry, extract: exact degree name, exact institution, graduation year.
10. Write a 2-3 sentence professional summary based SOLELY on actual resume content.
11. Score the resume 0-100 based on: completeness of sections (contact/summary/skills/experience/education), depth of experience, and skill variety.
12. If you see concatenated words like "SoftwareEngineer" split them into "Software Engineer" using context.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please parse this resume and extract all information with maximum accuracy:\n\n---RESUME START---\n${text.substring(0, 20000)}\n---RESUME END---`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_resume",
              description: "Extract all structured resume data with maximum accuracy.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full legal name of the candidate (first + last at minimum)" },
                  email: { type: "string", description: "Primary email address" },
                  phone: { type: "string", description: "Phone number exactly as found in the document" },
                  location: { type: "string", description: "City, State/Country" },
                  summary: { type: "string", description: "2-3 sentence professional summary of the candidate" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "ALL skills mentioned: languages, frameworks, tools, databases, cloud services, soft skills",
                  },
                  experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Exact job title" },
                        company: { type: "string", description: "Exact company/organization name" },
                        duration: { type: "string", description: "Exact date range e.g. 'Jan 2021 – Mar 2023'" },
                      },
                      required: ["title", "company", "duration"],
                    },
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string", description: "Exact degree or certification name" },
                        institution: { type: "string", description: "Exact university/institution name" },
                        year: { type: "string", description: "Graduation year or date range" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                  },
                  overall_score: {
                    type: "number",
                    description: "Resume quality/completeness score 0-100",
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

    // Validate: reject known placeholder/hallucinated values
    const placeholders = ["john doe", "jane doe", "example", "your name", "candidate name", "full name"];
    if (parsed.name && placeholders.some((p) => parsed.name.toLowerCase().includes(p))) {
      console.warn("Detected placeholder name, setting to null");
      parsed.name = null;
    }

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
