import { useEffect, useState } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import JobCard from "../components/ui/JobCard";
import JobFilters from "../components/filters/JobFilters";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Jobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ matchScore: "", location: "", experience: "" });

  useEffect(() => {
    fetchJobs();
    if (user) fetchSavedJobs();
  }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Calculate match scores if user has a resume
      if (user) {
        const { data: resume } = await supabase
          .from("resumes")
          .select("parsed_skills")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const candidateSkills = (resume?.parsed_skills || []).map((s: string) => s.toLowerCase());

        const jobsWithScores = data.map((job) => {
          const jobSkills = (job.skills_required || []).map((s: string) => s.toLowerCase());
          const matchCount = jobSkills.filter((s: string) => candidateSkills.includes(s)).length;
          const matchScore = jobSkills.length > 0 ? Math.round((matchCount / jobSkills.length) * 100) : 50;
          return { ...job, matchScore: Math.max(matchScore, 10) };
        });

        jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);
        setJobs(jobsWithScores);
      } else {
        setJobs(data.map((j) => ({ ...j, matchScore: 50 })));
      }
    }
    setLoading(false);
  };

  const fetchSavedJobs = async () => {
    const { data } = await supabase
      .from("saved_jobs")
      .select("job_id")
      .eq("user_id", user!.id);
    if (data) setSavedJobIds(new Set(data.map((s) => s.job_id)));
  };

  const handleSave = async (jobId: string) => {
    if (!user) {
      toast({ title: "Please sign in to save jobs", variant: "destructive" });
      return;
    }
    if (savedJobIds.has(jobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
      setSavedJobIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      setSavedJobIds((prev) => new Set(prev).add(jobId));
    }
  };

  const handleApply = async (jobId: string) => {
    if (!user) {
      toast({ title: "Please sign in to apply", variant: "destructive" });
      return;
    }
    // Get active resume
    const { data: resume } = await supabase
      .from("resumes")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const job = jobs.find((j) => j.id === jobId);
    const { error } = await supabase.from("job_applications").insert({
      job_id: jobId,
      candidate_id: user.id,
      resume_id: resume?.id || null,
      match_score: job?.matchScore || 0,
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already applied to this job" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Application submitted!" });
    }
  };

 const filteredJobs = jobs.filter((job) => {
  // Match Score Filter
  if (filters.matchScore && job.matchScore < parseInt(filters.matchScore)) {
    return false;
  }

  // Location Filter
  if (filters.location) {
    const locMap: Record<string, string> = {
      remote: "remote",
      "san-francisco": "san francisco",
      "new-york": "new york",
      seattle: "seattle",
      austin: "austin",
    };

    const selectedLocation = locMap[filters.location] || filters.location;

    if (!job.location?.toLowerCase().includes(selectedLocation)) {
      return false;
    }
  }

  // ✅ Experience Level Filter (NEW)
  if (filters.experience) {
    const expMap: Record<string, string[]> = {
      internship: ["intern", "internship"],
      entry: ["entry", "junior", "fresher"],
      mid: ["mid", "intermediate"],
      senior: ["senior", "lead", "principal"],
    };

    const jobExp = (job.experience_level || "").toLowerCase();
    const allowedKeywords = expMap[filters.experience] || [];

    const matchesExperience = allowedKeywords.some((keyword) =>
      jobExp.includes(keyword)
    );

    if (!matchesExperience) return false;
  }

  return true;
});

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="section-title mb-2 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-primary" />
              Job Recommendations
            </h1>
            <p className="text-muted-foreground">
              {loading ? "Loading..." : `${filteredJobs.length} jobs available • Sorted by match score`}
            </p>
          </div>

          <div className="mb-6">
            <JobFilters filters={filters} onFilterChange={setFilters} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job, index) => (
                  <div
                    key={job.id}
                    className="opacity-0 animate-fade-in-up"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: "forwards" }}
                  >
                    <JobCard
                      job={{
                        id: job.id,
                        title: job.title,
                        company: job.company,
                        location: job.location || "Remote",
                        matchScore: job.matchScore,
                        skills: job.skills_required || [],
                        experience: job.experience_level || "Not specified",
                        saved: savedJobIds.has(job.id),
                      }}
                      onSave={handleSave}
                      onApply={handleApply}
                    />
                  </div>
                ))
              ) : (
                <div className="card-elevated p-12 text-center">
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No jobs found</h3>
                  <p className="text-muted-foreground">
                    {jobs.length === 0 ? "No jobs posted yet. Check back soon!" : "Try adjusting your filters."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Jobs;
