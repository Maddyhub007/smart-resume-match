import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { resumeId } = await req.json();

    // Get the resume skills
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: resume } = await serviceClient
      .from("resumes")
      .select("parsed_skills")
      .eq("id", resumeId)
      .single();

    if (!resume) throw new Error("Resume not found");

    // Get all active jobs
    const { data: jobs } = await serviceClient
      .from("jobs")
      .select("*")
      .eq("is_active", true);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidateSkills = (resume.parsed_skills || []).map((s: string) => s.toLowerCase());

    // Calculate match scores
    const matches = jobs.map((job: any) => {
      const jobSkills = (job.skills_required || []).map((s: string) => s.toLowerCase());
      if (jobSkills.length === 0) return { ...job, match_score: 50 };
      
      const matchingSkills = jobSkills.filter((s: string) => candidateSkills.includes(s));
      const score = Math.round((matchingSkills.length / jobSkills.length) * 100);
      return { ...job, match_score: Math.max(score, 10) };
    });

    matches.sort((a: any, b: any) => b.match_score - a.match_score);

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-jobs error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
