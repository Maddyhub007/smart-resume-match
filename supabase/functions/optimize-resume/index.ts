import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { resumeData, jobDescription, jobTitle, jobSkills } = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert ATS resume optimizer. Analyze the resume against the job description and provide:
1. A list of missing skills the candidate should add
2. Suggested improvements for the summary section
3. An optimized version of the resume data tailored for this specific job

Return ONLY valid JSON using this structure. Do not wrap in markdown code blocks.`,
          },
          {
            role: "user",
            content: `Job Title: ${jobTitle || "Not specified"}
Job Required Skills: ${(jobSkills || []).join(", ")}
Job Description: ${jobDescription || "Not provided"}

Current Resume Data:
${JSON.stringify(resumeData, null, 2)}

Analyze and optimize.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "optimize_resume",
              description: "Return resume optimization analysis and optimized resume data",
              parameters: {
                type: "object",
                properties: {
                  missingSkills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Skills mentioned in the job but missing from the resume",
                  },
                  improvements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["section", "suggestion"],
                    },
                    description: "Specific improvement suggestions",
                  },
                  optimizedSummary: {
                    type: "string",
                    description: "An optimized professional summary tailored to this job",
                  },
                  optimizedSkills: {
                    type: "array",
                    items: { type: "string" },
                    description: "Updated skills list including relevant missing skills",
                  },
                  matchScore: {
                    type: "number",
                    description: "Estimated match score 0-100 after optimization",
                  },
                },
                required: ["missingSkills", "improvements", "optimizedSummary", "optimizedSkills", "matchScore"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "optimize_resume" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI optimization failed");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { missingSkills: [], improvements: [], optimizedSummary: resumeData.summary, optimizedSkills: resumeData.skills, matchScore: 50 };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("optimize-resume error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
