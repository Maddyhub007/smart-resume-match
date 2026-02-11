import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus, Trash2, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PostJob = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newReq, setNewReq] = useState("");
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    description: "",
    experience_level: "",
    salary_range: "",
    job_type: "full-time",
    skills_required: [] as string[],
    requirements: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.company) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("jobs").insert({
      recruiter_id: user!.id,
      ...form,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Job posted successfully!" });
      navigate("/recruiter");
    }
    setLoading(false);
  };

  const addSkill = () => {
    if (newSkill.trim() && !form.skills_required.includes(newSkill.trim())) {
      setForm({ ...form, skills_required: [...form.skills_required, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const addReq = () => {
    if (newReq.trim()) {
      setForm({ ...form, requirements: [...form.requirements, newReq.trim()] });
      setNewReq("");
    }
  };

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="section-title mb-2 flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            Post New Job
          </h1>
          <p className="text-muted-foreground mb-8">Fill in the details to post a new job listing.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Basic Info</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Job Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="e.g. Senior Frontend Developer" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Company *</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field" placeholder="e.g. TechCorp Inc." required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" placeholder="e.g. Remote, San Francisco" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Job Type</label>
                  <select value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })} className="input-field">
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Experience Level</label>
                  <select value={form.experience_level} onChange={(e) => setForm({ ...form, experience_level: e.target.value })} className="input-field">
                    <option value="">Select</option>
                    <option value="Entry Level">Entry Level</option>
                    <option value="Mid Level">Mid Level</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead / Principal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Salary Range</label>
                  <input value={form.salary_range} onChange={(e) => setForm({ ...form, salary_range: e.target.value })} className="input-field" placeholder="e.g. $120K - $160K" />
                </div>
              </div>
            </div>

            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Description</h3>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field min-h-[150px]" placeholder="Describe the role, responsibilities, and what you're looking for..." />
            </div>

            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Required Skills</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {form.skills_required.map((s) => (
                  <span key={s} className="skill-tag flex items-center gap-1">
                    {s}
                    <button type="button" onClick={() => setForm({ ...form, skills_required: form.skills_required.filter((x) => x !== s) })}><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Add skill" className="input-field flex-1" />
                <button type="button" onClick={addSkill} className="btn-secondary text-sm py-2 px-3"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="card-elevated p-6 space-y-4">
              <h3 className="font-semibold text-foreground">Requirements</h3>
              <ul className="space-y-2">
                {form.requirements.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {r}
                    <button type="button" onClick={() => setForm({ ...form, requirements: form.requirements.filter((_, idx) => idx !== i) })} className="text-destructive ml-auto"><Trash2 className="w-3 h-3" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input value={newReq} onChange={(e) => setNewReq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReq())} placeholder="Add requirement" className="input-field flex-1" />
                <button type="button" onClick={addReq} className="btn-secondary text-sm py-2 px-3"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => navigate("/recruiter")} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                Post Job
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default PostJob;
