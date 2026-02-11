import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Users, MessageSquare, Plus, TrendingUp, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const RecruiterDashboard = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ jobs: 0, applications: 0, conversations: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [jobsRes, appsRes, convsRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("recruiter_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("job_applications").select("job_id, jobs!inner(recruiter_id)").eq("jobs.recruiter_id", user!.id),
      supabase.from("conversations").select("id").eq("recruiter_id", user!.id),
    ]);

    const jobs = jobsRes.data || [];
    setRecentJobs(jobs.slice(0, 5));
    setStats({
      jobs: jobs.length,
      applications: appsRes.data?.length || 0,
      conversations: convsRes.data?.length || 0,
    });
    setLoading(false);
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="section-title mb-2">Recruiter Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || "Recruiter"}</p>
            </div>
            <Link to="/recruiter/post-job" className="btn-primary">
              <Plus className="w-5 h-5" /> Post New Job
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Active Jobs", value: stats.jobs, icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
              { label: "Applications", value: stats.applications, icon: Users, color: "text-accent", bg: "bg-accent/10" },
              { label: "Conversations", value: stats.conversations, icon: MessageSquare, color: "text-success", bg: "bg-success/10" },
            ].map((stat) => (
              <div key={stat.label} className="card-elevated p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Job Postings</h3>
              <Link to="/recruiter/post-job" className="text-sm text-primary hover:underline">View All</Link>
            </div>
            {recentJobs.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No jobs posted yet.</p>
                <Link to="/recruiter/post-job" className="btn-primary mt-4 inline-flex text-sm py-2 px-4">Post Your First Job</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <Link key={job.id} to={`/recruiter/applicants/${job.id}`} className="flex items-center justify-between p-4 rounded-xl hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium text-foreground">{job.title}</p>
                      <p className="text-sm text-muted-foreground">{job.company} • {job.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${job.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {job.is_active ? "Active" : "Closed"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RecruiterDashboard;
