import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Users, ArrowLeft, MessageSquare, Loader2, CheckCircle, XCircle, Clock, Eye, Download, ChevronDown, ChevronUp } from "lucide-react";
import Layout from "@/components/layout/Layout";
import MatchScoreRing from "@/components/ui/MatchScoreRing";
import SkillMatchBreakdown from "@/components/recruiter/SkillMatchBreakdown";
import TopApplicants from "@/components/recruiter/TopApplicants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Applicants = () => {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (jobId) fetchData();
  }, [jobId]);

  const fetchData = async () => {
    setLoading(true);
    const { data: jobData } = await supabase.from("jobs").select("*").eq("id", jobId!).single();
    setJob(jobData);

    const { data: apps } = await supabase
      .from("job_applications")
      .select("*, resumes(parsed_skills, overall_score, file_name, parsed_name, file_url)")
      .eq("job_id", jobId!)
      .order("created_at", { ascending: false });

    const enriched = await Promise.all(
      (apps || []).map(async (app) => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email, location")
          .eq("user_id", app.candidate_id)
          .single();
        return { ...app, candidateProfile: prof };
      })
    );

    enriched.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    setApplicants(enriched);
    setLoading(false);
  };

  const updateStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", appId);
    if (error) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
      return;
    }
    setApplicants((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    toast({ title: `Candidate ${status === "shortlisted" ? "accepted" : status === "rejected" ? "rejected" : "updated to " + status}` });
  };

  const downloadResume = async (fileUrl: string, fileName: string) => {
    try {
      const path = fileUrl.replace(/^.*\/object\/(?:public|sign)\/resumes\//, "");
      const { data, error } = await supabase.storage.from("resumes").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "resume";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Resume downloaded ✅" });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  };

  const startChat = async (candidateId: string) => {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("recruiter_id", user!.id)
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId!)
      .maybeSingle();

    if (existing) { navigate(`/chat/${existing.id}`); return; }

    const { data, error } = await supabase
      .from("conversations")
      .insert({ recruiter_id: user!.id, candidate_id: candidateId, job_id: jobId })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      navigate(`/chat/${data.id}`);
    }
  };

  const toggleSkills = (appId: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      next.has(appId) ? next.delete(appId) : next.add(appId);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "shortlisted": return "bg-success/10 text-success border-success/20";
      case "interview": return "bg-accent/10 text-accent border-accent/20";
      case "hired": return "bg-primary/10 text-primary border-primary/20";
      case "rejected": return "bg-destructive/10 text-destructive border-destructive/20";
      case "reviewing": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "shortlisted": case "hired": return <CheckCircle className="w-4 h-4" />;
      case "rejected": return <XCircle className="w-4 h-4" />;
      case "reviewing": case "interview": return <Clock className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
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
            <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" />
              Applicants for {job?.title}
            </h1>
            <p className="text-muted-foreground">{job?.company} • {job?.location || "Remote"} • {applicants.length} applicant(s)</p>
          </div>

          {/* Top Candidates */}
          {applicants.length > 1 && <TopApplicants applicants={applicants} />}

          {applicants.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No applicants yet</h3>
              <p className="text-muted-foreground">Share your job posting to attract candidates.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applicants.map((app) => {
                const resume = app.resumes as any;
                const candidateSkills = resume?.parsed_skills || [];
                const jobSkills = job?.skills_required || [];
                const isExpanded = expandedSkills.has(app.id);

                return (
                  <div key={app.id} className="card-elevated p-6">
                    <div className="flex flex-col gap-4">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg font-bold text-primary">
                              {(app.candidateProfile?.full_name || "U")[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground text-lg">
                              {app.candidateProfile?.full_name || resume?.parsed_name || "Unknown Candidate"}
                            </h3>
                            <p className="text-sm text-muted-foreground">{app.candidateProfile?.email}</p>
                            {app.candidateProfile?.location && (
                              <p className="text-sm text-muted-foreground">{app.candidateProfile.location}</p>
                            )}
                          </div>
                        </div>
                        <MatchScoreRing score={app.match_score || 0} size="sm" />
                      </div>

                      {/* Skill Match Breakdown (collapsible) */}
                      <div>
                        <button
                          onClick={() => toggleSkills(app.id)}
                          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isExpanded ? "Hide" : "View"} Skill Breakdown
                        </button>
                        {isExpanded && (
                          <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border">
                            <SkillMatchBreakdown candidateSkills={candidateSkills} jobSkills={jobSkills} />
                          </div>
                        )}
                      </div>

                      {/* Resume info + download */}
                      {resume && (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Resume: {resume?.file_name}</p>
                          {resume?.file_url && (
                            <button
                              onClick={() => downloadResume(resume.file_url, resume.file_name)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Resume
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status + Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${getStatusColor(app.status)}`}>
                            {getStatusIcon(app.status)}
                            {app.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {app.status !== "shortlisted" && app.status !== "hired" && (
                            <button
                              onClick={() => updateStatus(app.id, "shortlisted")}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-sm font-medium"
                            >
                              <CheckCircle className="w-4 h-4" /> Accept
                            </button>
                          )}
                          {app.status !== "rejected" && (
                            <button
                              onClick={() => updateStatus(app.id, "rejected")}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm font-medium"
                            >
                              <XCircle className="w-4 h-4" /> Reject
                            </button>
                          )}
                          <button
                            onClick={() => startChat(app.candidate_id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            <MessageSquare className="w-4 h-4" /> Message
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Applicants;
