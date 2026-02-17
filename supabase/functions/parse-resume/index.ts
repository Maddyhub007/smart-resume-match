import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract readable text from PDF bytes without any external dependencies
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  // Convert bytes to latin1 string for regex processing
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const textChunks: string[] = [];
  
  // Extract from BT..ET text blocks (uncompressed streams)
  const btEtRegex = /BT([\s\S]*?)ET/g;
  let btMatch;
  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];
    
    // TJ arrays
    const tjArrayRegex = /\[((?:\([^)]*\)|<[^>]*>|[-\d.\s]+)*)\]\s*TJ/gi;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const parts = /\(([^)]*)\)/g;
      let p;
      while ((p = parts.exec(inner)) !== null) {
        textChunks.push(p[1]);
      }
    }
    
    // Single Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textChunks.push(tjMatch[1]);
    }
  }

  let text = textChunks.join(" ")
    .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1")
    .replace(/\s+/g, " ").trim();

  // Most modern PDFs use compressed streams - fall back to extracting printable ASCII
  if (text.length < 100) {
    console.log("BT/ET extraction got little text, using ASCII fallback...");
    const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
    const decoded = utf8Decoder.decode(bytes);
    // Extract runs of printable chars (min 3 chars)
    const asciiRuns = decoded.match(/[\x20-\x7E]{3,}/g) || [];
    // Filter out PDF structural tokens
    const filtered = asciiRuns.filter((c: string) => {
      if (/^[%\/\[\]<>{}\\()]+$/.test(c)) return false;
      if (/^[\d\s.]+$/.test(c)) return false;
      if (/^(obj|endobj|stream|endstream|xref|trailer|startxref)$/i.test(c.trim())) return false;
      if (c.includes("/Type") || c.includes("/Font") || c.includes("/Page")) return false;
      if (c.includes("FlateDecode") || c.includes("/Filter")) return false;
      return true;
    });
    const fallback = filtered.join(" ").replace(/\s+/g, " ").trim();
    if (fallback.length > text.length) text = fallback;
  }

  return text;
}

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const text = extractTextFromPdfBytes(bytes);
    console.log("PDF text extracted, length:", text.length);
    return text;
  }
  return await fileData.text();
}

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
    console.log("Extracted text length:", text.length);
    console.log("Extracted text preview (first 500 chars):", text.substring(0, 500));

    if (!text || text.trim().length < 10) {
      throw new Error("Could not extract meaningful text from the file. The PDF may be image-based (scanned). Please try a text-based PDF.");
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
            content: `You are a highly accurate resume parser. Extract EXACT information from the resume text. The text may contain noise from PDF extraction - ignore non-resume content and focus on the actual resume data.

RULES:
1. Extract the REAL name - usually at the top. NEVER make up names.
2. Extract REAL email, phone, location exactly as written.
3. Extract ALL education with EXACT degree, institution, year.
4. Extract ALL experience with EXACT title, company, duration.
5. Extract ALL skills - technical, tools, frameworks, soft skills.
6. Write a professional summary from ACTUAL content.
7. Score 0-100 based on completeness and quality.
If a field is missing, return null or empty array. NEVER fabricate data.`,
          },
          {
            role: "user",
            content: `Parse this resume and extract all information EXACTLY as written:\n\n${text.substring(0, 15000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_resume",
              description: "Extract structured resume data exactly as written.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name from resume" },
                  email: { type: "string", description: "Email from resume" },
                  phone: { type: "string", description: "Phone from resume" },
                  location: { type: "string", description: "Location from resume" },
                  summary: { type: "string", description: "2-3 sentence summary" },
                  skills: { type: "array", items: { type: "string" }, description: "All skills" },
                  experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        company: { type: "string" },
                        duration: { type: "string" },
                      },
                      required: ["title", "company", "duration"],
                    },
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string" },
                        institution: { type: "string" },
                        year: { type: "string" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                  },
                  overall_score: { type: "number", description: "Quality score 0-100" },
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
      throw new Error("AI parsing failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response from AI");

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log("Parsed result:", JSON.stringify(parsed, null, 2));

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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
