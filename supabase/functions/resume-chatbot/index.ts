import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEPS = [
  { key: "greeting", question: "Hi! I'm your AI Resume Assistant. I'll help you build a professional resume step by step. Let's start — what's your **full name**?" },
  { key: "email", question: "Great! What's your **email address**?" },
  { key: "phone", question: "And your **phone number**?" },
  { key: "location", question: "Where are you based? (City, Country)" },
  { key: "summary", question: "Write a brief **professional summary** (2-3 sentences about your career goals and strengths)." },
  { key: "experience", question: "Let's add your **work experience**. Please describe your most recent role in this format:\n\n**Job Title** at **Company** (Start Date - End Date)\n- Key responsibility or achievement\n- Another achievement\n\nYou can add multiple roles. Type **'done'** when you've listed all your experience." },
  { key: "education", question: "Now let's add your **education**. Please share:\n\n**Degree** from **University** (Year)\n\nType **'done'** when finished." },
  { key: "skills", question: "List your **key skills** separated by commas (e.g. JavaScript, React, Project Management, Data Analysis)." },
  { key: "complete", question: "" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, currentStep, collectedData } = await req.json();

    // If we're at the complete step, generate the final resume
    if (currentStep === "complete") {
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
              content: `You are a professional resume writer. Based on the collected data, generate a polished, ATS-optimized resume in JSON format. Return ONLY valid JSON with this structure:
{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "location": "" },
  "summary": "",
  "experience": [{ "title": "", "company": "", "startDate": "", "endDate": "", "description": "" }],
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "skills": ["skill1", "skill2"]
}

Enhance the summary and descriptions to be professional and impactful. Fix any formatting issues. Make bullet points action-oriented.`,
            },
            {
              role: "user",
              content: `Here is the collected resume data:\n${JSON.stringify(collectedData, null, 2)}\n\nGenerate the polished resume JSON.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_resume",
                description: "Generate structured resume data",
                parameters: {
                  type: "object",
                  properties: {
                    personalInfo: {
                      type: "object",
                      properties: {
                        fullName: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                        location: { type: "string" },
                      },
                      required: ["fullName", "email", "phone", "location"],
                    },
                    summary: { type: "string" },
                    experience: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          company: { type: "string" },
                          startDate: { type: "string" },
                          endDate: { type: "string" },
                          description: { type: "string" },
                        },
                        required: ["title", "company", "description"],
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
                        required: ["degree", "institution"],
                      },
                    },
                    skills: { type: "array", items: { type: "string" } },
                  },
                  required: ["personalInfo", "summary", "experience", "education", "skills"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_resume" } },
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
        throw new Error("AI generation failed");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let resumeData;
      if (toolCall?.function?.arguments) {
        resumeData = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try parsing content
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        resumeData = jsonMatch ? JSON.parse(jsonMatch[0]) : collectedData;
      }

      return new Response(JSON.stringify({
        type: "resume_complete",
        resumeData,
        message: "🎉 Your resume has been generated! I've polished your content to be professional and ATS-friendly. You can now review and edit it in the Resume Builder.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For regular conversation steps, use AI to enhance the response
    const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
    const nextStep = stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1] : STEPS[STEPS.length - 1];

    // Use AI to provide a friendly, contextual response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a friendly resume building assistant. The user just provided their ${currentStep}. 
Acknowledge what they shared with a brief, encouraging comment (1 sentence max), then ask the next question.
Next question to ask: "${nextStep.question}"
Keep your response concise and friendly. Use markdown formatting.`,
          },
          ...messages.slice(-3),
        ],
      }),
    });

    if (!response.ok) {
      // Fallback to scripted response
      return new Response(JSON.stringify({
        type: "question",
        nextStep: nextStep.key,
        message: `Got it! ${nextStep.question}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await response.json();
    const aiMessage = aiResp.choices?.[0]?.message?.content || `Got it! ${nextStep.question}`;

    return new Response(JSON.stringify({
      type: "question",
      nextStep: nextStep.key,
      message: aiMessage,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resume-chatbot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
