import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function extractText(fileData: Blob, fileName: string): Promise<string> {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.endsWith(".pdf")) {
    const { default: pdfParse } = await import("https://esm.sh/pdf-parse@1.1.1");
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const data = await pdfParse(buffer);
    console.log("PDF parsed, pages:", data.numpages, "text length:", data.text.length);
    return data.text;
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
    console.log("Extracted text preview (first 800 chars):", text.substring(0, 800));

    if (!text || text.trim().length < 20) {
      throw new Error("Could not extract meaningful text from the file. The file may be image-based or corrupted.");
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
            content: `You are a highly accurate resume parser. Your job is to extract EXACT information from the resume text provided. 

CRITICAL RULES:
1. Extract the REAL name from the resume - do NOT make up names like "John Doe". The name is usually at the very top of the resume.
2. Extract the REAL email, phone, and location exactly as written in the resume.
3. Extract ALL education entries with the EXACT degree name, institution name, and graduation year as written.
4. Extract ALL work experience entries with EXACT job titles, company names, and durations as written.
5. Extract ALL skills mentioned anywhere in the resume.
6. Write a professional summary based on the ACTUAL content of the resume.
7. Score the resume quality from 0-100 based on completeness, formatting indicators, and skill diversity.

If any field is not found in the resume, return null for strings or empty arrays for lists. NEVER fabricate or guess information.`,
          },
          {
            role: "user",
            content: `Parse this resume text and extract all information EXACTLY as written. Do not invent or guess any data:\n\n${text.substring(0, 12000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_resume",
              description: "Extract structured data from a resume. All fields must contain EXACT text from the resume, never fabricated data.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The person's full name exactly as it appears at the top of the resume" },
                  email: { type: "string", description: "Email address exactly as written in the resume" },
                  phone: { type: "string", description: "Phone number exactly as written in the resume" },
                  location: { type: "string", description: "Location/address exactly as written in the resume" },
                  summary: { type: "string", description: "A 2-3 sentence professional summary based on the actual resume content" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "All skills mentioned in the resume, including technical skills, tools, frameworks, soft skills, and certifications",
                  },
                  experience: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Exact job title as written" },
                        company: { type: "string", description: "Exact company name as written" },
                        duration: { type: "string", description: "Exact date range as written (e.g., 'Jan 2020 - Present')" },
                      },
                      required: ["title", "company", "duration"],
                    },
                    description: "All work/internship experience entries",
                  },
                  education: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        degree: { type: "string", description: "Exact degree/certification name as written (e.g., 'B.E. Computer Science and Engineering')" },
                        institution: { type: "string", description: "Exact institution/university name as written" },
                        year: { type: "string", description: "Graduation year or date range as written" },
                      },
                      required: ["degree", "institution", "year"],
                    },
                    description: "All education entries including degrees, certifications, and courses",
                  },
                  overall_score: {
                    type: "number",
                    description: "Resume quality score 0-100 based on: completeness of sections (20pts), skill diversity (20pts), experience relevance (20pts), education (20pts), and overall presentation (20pts)",
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
