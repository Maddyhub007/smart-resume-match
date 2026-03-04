import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExternalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  skills: string[];
  experience: string;
  jobType: string;
  description: string;
  source: string;
  postedAt: string;
  salary?: string;
}

interface FetchParams {
  keyword?: string;
  location?: string;
  experience?: string;
  jobType?: string;
  page?: number;
  perPage?: number;
}

async function fetchRemotiveJobs(params: FetchParams): Promise<ExternalJob[]> {
  try {
    const url = new URL("https://remotive.com/api/remote-jobs");
    if (params.keyword) url.searchParams.set("search", params.keyword);
    if (params.perPage) url.searchParams.set("limit", String(params.perPage));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map((j: any) => ({
      id: `remotive-${j.id}`,
      title: j.title || "Untitled",
      company: j.company_name || "Unknown",
      location: j.candidate_required_location || "Remote",
      url: j.url || "",
      skills: extractSkillsFromTags(j.tags || []),
      experience: mapExperience(j.title, j.description),
      jobType: j.job_type || "full_time",
      description: stripHtml(j.description || "").slice(0, 300),
      source: "Remotive",
      postedAt: j.publication_date || new Date().toISOString(),
      salary: j.salary || undefined,
    }));
  } catch (e) {
    console.error("Remotive error:", e);
    return [];
  }
}

async function fetchArbeitnowJobs(params: FetchParams): Promise<ExternalJob[]> {
  try {
    const url = new URL("https://www.arbeitnow.com/api/job-board-api");
    if (params.page && params.page > 1) url.searchParams.set("page", String(params.page));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const jobs = data.data || [];

    return jobs.map((j: any) => ({
      id: `arbeitnow-${j.slug}`,
      title: j.title || "Untitled",
      company: j.company_name || "Unknown",
      location: j.location || (j.remote ? "Remote" : "On-site"),
      url: j.url || "",
      skills: extractSkillsFromTags(j.tags || []),
      experience: mapExperience(j.title, j.description),
      jobType: j.remote ? "remote" : "full_time",
      description: stripHtml(j.description || "").slice(0, 300),
      source: "Arbeitnow",
      postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
      salary: undefined,
    }));
  } catch (e) {
    console.error("Arbeitnow error:", e);
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractSkillsFromTags(tags: string[]): string[] {
  return tags.filter((t: string) => t && t.length < 30).slice(0, 8);
}

function mapExperience(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  if (/intern|internship/.test(text)) return "Internship";
  if (/senior|sr\.|lead|principal|staff/.test(text)) return "Senior";
  if (/mid[- ]?level|intermediate|3\+\s*years|4\+\s*years|5\+\s*years/.test(text)) return "Mid Level";
  if (/junior|entry|graduate|fresher|0-2\s*years|1\+\s*year/.test(text)) return "Entry Level";
  return "Not specified";
}

function filterJobs(jobs: ExternalJob[], params: FetchParams): ExternalJob[] {
  return jobs.filter((job) => {
    // Keyword filter
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      const searchable = `${job.title} ${job.company} ${job.description} ${job.skills.join(" ")}`.toLowerCase();
      if (!searchable.includes(kw)) return false;
    }

    // Location filter
    if (params.location) {
      const loc = params.location.toLowerCase();
      if (!job.location.toLowerCase().includes(loc)) return false;
    }

    // Experience filter
    if (params.experience) {
      const exp = params.experience.toLowerCase();
      if (!job.experience.toLowerCase().includes(exp)) return false;
    }

    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const params: FetchParams = req.method === "POST" ? await req.json() : {};
    const page = params.page || 1;
    const perPage = params.perPage || 20;

    // Fetch from multiple sources in parallel
    const [remotiveJobs, arbeitnowJobs] = await Promise.all([
      fetchRemotiveJobs({ ...params, perPage: 50 }),
      fetchArbeitnowJobs({ ...params, page }),
    ]);

    // Merge and filter
    let allJobs = [...remotiveJobs, ...arbeitnowJobs];
    allJobs = filterJobs(allJobs, params);

    // Sort by posted date (newest first)
    allJobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

    // Paginate
    const totalJobs = allJobs.length;
    const start = (page - 1) * perPage;
    const paginatedJobs = allJobs.slice(start, start + perPage);

    return new Response(
      JSON.stringify({
        jobs: paginatedJobs,
        pagination: {
          page,
          perPage,
          total: totalJobs,
          totalPages: Math.ceil(totalJobs / perPage),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-external-jobs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
