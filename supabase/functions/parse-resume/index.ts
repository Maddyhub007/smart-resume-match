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

    if (hasNewline) chunks.push("\n");
  }

  return chunks;
}

// ─── Main PDF text extractor ─────────────────────────────────────────────────

async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const latin1 = new TextDecoder("latin1");
  const utf8 = new TextDecoder("utf-8", { fatal: false });

  const raw = latin1.decode(bytes);
  const allChunks: string[] = [];

  // Find all stream/endstream pairs
  const streamRegex = /<<([\s\S]{1,3000}?)>>\s*stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = streamRegex.exec(raw)) !== null) {
    const dictPart = m[1];
    const streamDataStart = m.index + m[0].length;

    const endIdx = raw.indexOf("endstream", streamDataStart);
    if (endIdx === -1) continue;

    if (/\/Subtype\s*\/Image/.test(dictPart)) continue;

    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictPart) ||
      /\/Filter\s*\[[\s\S]*?FlateDecode[\s\S]*?\]/.test(dictPart);
    const isNoFilter = !/\/Filter/.test(dictPart);
    const isContent = /\/Filter|\/Length/.test(dictPart);
    if (!isContent && !isNoFilter) continue;

    let streamBytes = bytes.slice(streamDataStart, endIdx);
    if (streamBytes[streamBytes.length - 1] === 10) streamBytes = streamBytes.slice(0, -1);
    if (streamBytes[streamBytes.length - 1] === 13) streamBytes = streamBytes.slice(0, -1);

    let decoded: string;
    if (isFlate) {
      const decompressed = await zlibDecompress(streamBytes);
      if (!decompressed) continue;
      decoded = utf8.decode(decompressed);
    } else if (isNoFilter || !isFlate) {
      decoded = utf8.decode(streamBytes);
    } else {
      continue;
    }

    const chunks = extractFromContentStream(decoded);
    allChunks.push(...chunks);
  }

  // Join with smart spacing - preserve newlines for structure
  let text = allChunks
    .join(" ")
    .replace(/\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .trim();

  console.log(`Extracted text length: ${text.length}`);
  console.log(`Preview: ${text.substring(0, 800)}`);

  // ── Fallback: if still short, use printable-run heuristic ────────────────
  if (text.length < 300) {
    console.log("Short extraction, trying UTF-8 printable fallback...");
    const full = utf8.decode(bytes);
    const runs = full.match(/[a-zA-Z][a-zA-Z0-9@.,:()\-+/\s]{3,}/g) || [];
    const pdfKeywords = new Set(["obj", "endobj", "stream", "endstream", "xref", "trailer", "startxref", "FlateDecode", "Filter", "Font", "Page", "Encoding", "Resources", "Type", "Catalog", "MediaBox", "Contents"]);
    const fallback = runs
      .filter((s) => s.split(/\s+/).length >= 2)
      .filter((s) => !pdfKeywords.has(s.trim()))
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

// ─── DOCX text extractor (basic XML parsing) ────────────────────────────────

async function extractTextFromDocx(blob: Blob): Promise<string> {
  try {
    // DOCX is a ZIP containing XML files. We'll look for word/document.xml
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    
    // Find PK signature (ZIP)
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
      // Not a valid ZIP/DOCX, try plain text
      return await blob.text();
    }

    // Simple approach: convert to text and extract from XML tags
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const fullText = decoder.decode(bytes);
    
    // Find word/document.xml content in the ZIP
    const docXmlStart = fullText.indexOf("<w:body");
    if (docXmlStart === -1) {
      // Fallback: extract any readable text
      return await blob.text();
    }
    
    const docXmlEnd = fullText.indexOf("</w:body>", docXmlStart);
    const docXml = fullText.substring(docXmlStart, docXmlEnd > -1 ? docXmlEnd + 9 : undefined);
    
    // Extract text from <w:t> tags
    const textParts: string[] = [];
    const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = regex.exec(docXml)) !== null) {
      if (match[1].trim()) textParts.push(match[1]);
    }
    
    // Also handle paragraph breaks
    let result = "";
    const paragraphs = docXml.split(/<\/w:p>/);
    for (const para of paragraphs) {
      const paraTexts: string[] = [];
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(para)) !== null) {
        paraTexts.push(tMatch[1]);
      }
      if (paraTexts.length > 0) {
        result += paraTexts.join("") + "\n";
      }
    }
    
    return result.trim() || textParts.join(" ");
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return await blob.text();
  }
}

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const buf = await fileData.arrayBuffer();
    return extractTextFromPdfBytes(new Uint8Array(buf));
  }
  if (lower.endsWith(".docx")) {
    return extractTextFromDocx(fileData);
  }
  // For TXT and other text files
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

    const systemPrompt = `You are the world's most accurate resume parser. You have 20+ years of experience in HR, ATS systems, and recruitment.

Your CRITICAL task: extract EVERY piece of information from the resume text with 100% accuracy and fidelity.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. ONLY use information EXPLICITLY present in the text. NEVER fabricate, hallucinate, or guess ANY data.
2. If a field is missing from the resume, return null — NOT a placeholder.
3. NEVER return generic names like "John Doe", "Jane Smith", "Your Name", "Candidate Name", "Full Name", etc.
4. NEVER return generic emails like "example@email.com", "email@example.com", etc.
5. The text may have garbled spacing from PDF extraction — use context to intelligently re-join words (e.g., "Soft ware En gineer" → "Software Engineer").
6. Extract the FULL NAME from the very top of the resume (it's usually the largest/first text element). Look for proper nouns at the beginning.
7. Extract email exactly as written (look for @ symbol patterns).
8. Extract phone exactly as written (look for digit patterns: 10+ digits, with optional +, dashes, spaces, parentheses).
9. Extract ALL skills mentioned anywhere: programming languages, frameworks, tools, databases, cloud services, methodologies, soft skills, certifications.
10. For each experience entry: exact job title, exact company name, exact date range as written.
11. For each education entry: exact degree name, exact institution name, graduation year or date range.
12. Write a 2-3 sentence professional summary based SOLELY on the actual resume content — mention specific technologies, years of experience, and domain expertise found in the resume.
13. Score the resume 0-100 based on:
   - Contact info completeness (name, email, phone, location) = 15 points
   - Professional summary quality = 10 points
   - Skills variety and relevance = 20 points
   - Experience depth (descriptions, quantified achievements) = 30 points
   - Education = 10 points
   - Projects/achievements/certifications = 15 points
14. Generate 3-5 PERSONALIZED improvement tips based on what's ACTUALLY in or missing from THIS specific resume. Reference specific sections and skills. Do NOT give generic tips.

IMPROVEMENT TIP RULES:
- Each tip must reference something specific from the resume or a specific gap
- Include the type: "warning" for missing critical sections, "suggestion" for enhancements, "improvement" for optimization
- Be specific: Instead of "Add more skills", say "Your Python experience lacks framework specifics — consider highlighting Django/Flask expertise"
- Reference the candidate's actual field/industry`;

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
            content: `Parse this resume with maximum accuracy. Extract every detail faithfully. Generate personalized improvement tips specific to THIS resume's content.\n\n---RESUME TEXT (${text.length} characters)---\n${text.substring(0, 20000)}\n---END---`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_resume",
              description: "Extract all structured resume data with maximum accuracy and generate personalized tips.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full legal name of the candidate (first + last at minimum). Must be from actual resume, never a placeholder." },
                  email: { type: "string", description: "Primary email address exactly as found" },
                  phone: { type: "string", description: "Phone number exactly as found" },
                  location: { type: "string", description: "City, State/Country" },
                  summary: { type: "string", description: "2-3 sentence professional summary based on ACTUAL resume content, mentioning specific skills and experience" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "ALL skills mentioned: languages, frameworks, tools, databases, cloud, methodologies, soft skills, certifications",
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
                    description: "Resume quality score 0-100 based on the detailed rubric",
                  },
                  improvement_tips: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["warning", "suggestion", "improvement"], description: "Tip severity" },
                        skill: { type: "string", description: "Short label for the tip area (e.g. 'Missing Projects Section', 'Quantify Achievements')" },
                        message: { type: "string", description: "Specific, actionable advice referencing THIS resume's content" },
                      },
                      required: ["type", "skill", "message"],
                    },
                    description: "3-5 personalized tips specific to THIS resume",
                  },
                },
                required: ["name", "skills", "experience", "education", "overall_score", "improvement_tips"],
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
    const placeholders = ["john doe", "jane doe", "example", "your name", "candidate name", "full name", "jane smith", "john smith"];
    if (parsed.name && placeholders.some((p) => parsed.name.toLowerCase().includes(p))) {
      console.warn("Detected placeholder name, setting to null");
      parsed.name = null;
    }
    if (parsed.email && (parsed.email.includes("example.com") || parsed.email.includes("placeholder"))) {
      parsed.email = null;
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