import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Users, ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import MatchScoreRing from "@/components/ui/MatchScoreRing";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Applicants = () => {
  const { jobId } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (jobId) fetchData();
  }, [jobId]);

  const fetchData = async () => {
    setLoading(true);
    const [jobRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", jobId).single(),
      supabase.from("job_applications")
        .select("*, profiles!job_applications_candidate_id_fkey(full_name, email, location), resumes(parsed_skills, overall_score, file_name)")
        .eq("job_id", jobId!)
        .order("match_score", { ascending: false }),
    ]);
    setJob(jobRes.data);
    setApplicants(appsRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (appId: string, status: string) => {
    await supabase.from("job_applications").update({ status }).eq("id", appId);
    setApplicants((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    toast({ title: `Status updated to ${status}` });
  };

  const startChat = async (candidateId: string) => {
    // Check if conversation exists
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("recruiter_id", user!.id)
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId!)
      .maybeSingle();

    if (existing) {
      window.location.href = `/chat/${existing.id}`;
      return;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({ recruiter_id: user!.id, candidate_id: candidateId, job_id: jobId })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      window.location.href = `/chat/${data.id}`;
    }
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Link to="/recruiter" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="mb-8">
            <h1 className="section-title mb-2 flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Applicants for {job?.title}
            </h1>
            <p className="text-muted-foreground">{job?.company} • {applicants.length} applicant(s)</p>
          </div>

          {applicants.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No applicants yet</h3>
              <p className="text-muted-foreground">Share your job posting to attract candidates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applicants.map((app) => (
                <div key={app.id} className="card-elevated p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{(app.profiles as any)?.full_name || "Unknown"}</h3>
                      <p className="text-sm text-muted-foreground">{(app.profiles as any)?.email}</p>
                      {(app.profiles as any)?.location && (
                        <p className="text-sm text-muted-foreground">{(app.profiles as any)?.location}</p>
                      )}
                      {app.resumes && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">Resume: {(app.resumes as any)?.file_name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((app.resumes as any)?.parsed_skills || []).slice(0, 5).map((s: string) => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <MatchScoreRing score={app.match_score || 0} size="sm" />

                      <select
                        value={app.status}
                        onChange={(e) => updateStatus(app.id, e.target.value)}
                        className="input-field text-sm py-1.5 w-auto"
                      >
                        <option value="applied">Applied</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="interview">Interview</option>
                        <option value="rejected">Rejected</option>
                        <option value="hired">Hired</option>
                      </select>

                      <button
                        onClick={() => startChat(app.candidate_id)}
                        className="btn-secondary text-sm py-2 px-3"
                      >
                        <MessageSquare className="w-4 h-4" /> Chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Applicants;
