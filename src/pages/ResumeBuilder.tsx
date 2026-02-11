import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PenTool, Download, Save, Plus, Trash2, Loader2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ResumeData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: { title: string; company: string; duration: string; description: string }[];
  education: { degree: string; institution: string; year: string }[];
}

const emptyResume: ResumeData = {
  fullName: "", email: "", phone: "", location: "", summary: "", skills: [],
  experience: [{ title: "", company: "", duration: "", description: "" }],
  education: [{ degree: "", institution: "", year: "" }],
};

const ResumeBuilder = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("professional");
  const [userResumes, setUserResumes] = useState<any[]>([]);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData>(emptyResume);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [templatesRes, resumesRes] = await Promise.all([
      supabase.from("resume_templates").select("*"),
      supabase.from("user_resumes").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false }),
    ]);
    setTemplates(templatesRes.data || []);
    setUserResumes(resumesRes.data || []);

    // Pre-fill from profile
    if (profile) {
      setResumeData((prev) => ({
        ...prev,
        fullName: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
      }));
    }

    // Pre-fill from latest uploaded resume
    const { data: latestResume } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestResume && latestResume.parsed_skills?.length > 0) {
      setResumeData((prev) => ({
        ...prev,
        fullName: prev.fullName || latestResume.parsed_name || "",
        email: prev.email || latestResume.parsed_email || "",
        phone: prev.phone || latestResume.parsed_phone || "",
        location: prev.location || latestResume.parsed_location || "",
        summary: prev.summary || latestResume.parsed_summary || "",
        skills: latestResume.parsed_skills || [],
        experience: (latestResume.parsed_experience as any[])?.length > 0
          ? (latestResume.parsed_experience as any[]).map((e: any) => ({ ...e, description: "" }))
          : prev.experience,
        education: (latestResume.parsed_education as any[])?.length > 0
          ? latestResume.parsed_education as any[]
          : prev.education,
      }));
    }
    setLoading(false);
  };

  const loadUserResume = (resume: any) => {
    setEditingResumeId(resume.id);
    setResumeData(resume.resume_data as ResumeData);
    setSelectedTemplate((resume.resume_data as any)?.templateStyle || "professional");
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      user_id: user!.id,
      title: `${resumeData.fullName || "Untitled"} - ${selectedTemplate}`,
      resume_data: { ...resumeData, templateStyle: selectedTemplate },
    };

    if (editingResumeId) {
      await supabase.from("user_resumes").update(payload).eq("id", editingResumeId);
    } else {
      const tmpl = templates.find((t) => (t.template_data as any)?.style === selectedTemplate);
      const { data } = await supabase.from("user_resumes").insert({ ...payload, template_id: tmpl?.id }).select().single();
      if (data) setEditingResumeId(data.id);
    }

    toast({ title: "Resume saved!" });
    setSaving(false);
    fetchData();
  };

  const handleDownload = () => {
    // Generate HTML resume for download
    const html = generateResumeHTML(resumeData, selectedTemplate);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resumeData.fullName || "resume"}_${selectedTemplate}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Resume downloaded!" });
  };

  const addSkill = () => {
    if (newSkill.trim() && !resumeData.skills.includes(newSkill.trim())) {
      setResumeData({ ...resumeData, skills: [...resumeData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const removeSkill = (skill: string) => {
    setResumeData({ ...resumeData, skills: resumeData.skills.filter((s) => s !== skill) });
  };

  const updateExperience = (index: number, field: string, value: string) => {
    const exp = [...resumeData.experience];
    (exp[index] as any)[field] = value;
    setResumeData({ ...resumeData, experience: exp });
  };

  const updateEducation = (index: number, field: string, value: string) => {
    const edu = [...resumeData.education];
    (edu[index] as any)[field] = value;
    setResumeData({ ...resumeData, education: edu });
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
              <h1 className="section-title mb-2 flex items-center gap-3">
                <PenTool className="w-8 h-8 text-primary" />
                Resume Builder
              </h1>
              <p className="text-muted-foreground">Create ATS-friendly resumes from templates</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm py-2 px-4">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button onClick={handleDownload} className="btn-primary text-sm py-2 px-4">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>

          {/* Previous resumes */}
          {userResumes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-foreground mb-3">Your Saved Resumes</h3>
              <div className="flex flex-wrap gap-3">
                {userResumes.map((r) => (
                  <button key={r.id} onClick={() => loadUserResume(r)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      editingResumeId === r.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {r.title}
                  </button>
                ))}
                <button onClick={() => { setEditingResumeId(null); setResumeData(emptyResume); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-border text-muted-foreground hover:border-primary flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> New
                </button>
              </div>
            </div>
          )}

          {/* Template selection */}
          <div className="mb-8">
            <h3 className="font-semibold text-foreground mb-3">Choose Template</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {templates.map((t) => {
                const style = (t.template_data as any)?.style;
                return (
                  <button key={t.id} onClick={() => setSelectedTemplate(style)}
                    className={`card-elevated p-4 text-center transition-all ${selectedTemplate === style ? "border-primary ring-2 ring-primary/20" : ""}`}
                  >
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Editor */}
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Personal Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input value={resumeData.fullName} onChange={(e) => setResumeData({ ...resumeData, fullName: e.target.value })} placeholder="Full Name" className="input-field col-span-2" />
                  <input value={resumeData.email} onChange={(e) => setResumeData({ ...resumeData, email: e.target.value })} placeholder="Email" className="input-field" />
                  <input value={resumeData.phone} onChange={(e) => setResumeData({ ...resumeData, phone: e.target.value })} placeholder="Phone" className="input-field" />
                  <input value={resumeData.location} onChange={(e) => setResumeData({ ...resumeData, location: e.target.value })} placeholder="Location" className="input-field col-span-2" />
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Summary</h3>
                <textarea value={resumeData.summary} onChange={(e) => setResumeData({ ...resumeData, summary: e.target.value })} placeholder="Professional summary..." className="input-field min-h-[100px]" />
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Skills</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {resumeData.skills.map((s) => (
                    <span key={s} className="skill-tag flex items-center gap-1">
                      {s}
                      <button onClick={() => removeSkill(s)} className="hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} placeholder="Add skill" className="input-field flex-1" />
                  <button onClick={addSkill} className="btn-secondary text-sm py-2 px-3"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Experience</h3>
                {resumeData.experience.map((exp, i) => (
                  <div key={i} className="space-y-3 mb-4 pb-4 border-b border-border last:border-0">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={exp.title} onChange={(e) => updateExperience(i, "title", e.target.value)} placeholder="Job Title" className="input-field" />
                      <input value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} placeholder="Company" className="input-field" />
                      <input value={exp.duration} onChange={(e) => updateExperience(i, "duration", e.target.value)} placeholder="Duration" className="input-field" />
                    </div>
                    <textarea value={exp.description} onChange={(e) => updateExperience(i, "description", e.target.value)} placeholder="Description" className="input-field min-h-[60px]" />
                  </div>
                ))}
                <button onClick={() => setResumeData({ ...resumeData, experience: [...resumeData.experience, { title: "", company: "", duration: "", description: "" }] })}
                  className="text-sm text-primary hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add Experience</button>
              </div>

              <div className="card-elevated p-6">
                <h3 className="font-semibold text-foreground mb-4">Education</h3>
                {resumeData.education.map((edu, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 mb-3">
                    <input value={edu.degree} onChange={(e) => updateEducation(i, "degree", e.target.value)} placeholder="Degree" className="input-field" />
                    <input value={edu.institution} onChange={(e) => updateEducation(i, "institution", e.target.value)} placeholder="Institution" className="input-field" />
                    <input value={edu.year} onChange={(e) => updateEducation(i, "year", e.target.value)} placeholder="Year" className="input-field" />
                  </div>
                ))}
                <button onClick={() => setResumeData({ ...resumeData, education: [...resumeData.education, { degree: "", institution: "", year: "" }] })}
                  className="text-sm text-primary hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add Education</button>
              </div>
            </div>

            {/* Preview */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="card-elevated p-8 bg-card">
                <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wide">Preview — {selectedTemplate}</div>
                <ResumePreview data={resumeData} style={selectedTemplate} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const ResumePreview = ({ data, style }: { data: ResumeData; style: string }) => {
  const borderColor = style === "modern" ? "border-l-4 border-primary" : style === "creative" ? "border-l-4 border-accent" : "";

  return (
    <div className={`space-y-4 text-sm ${borderColor} ${borderColor ? "pl-4" : ""}`}>
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">{data.fullName || "Your Name"}</h2>
        <p className="text-muted-foreground text-xs mt-1">
          {[data.email, data.phone, data.location].filter(Boolean).join(" • ") || "Contact info"}
        </p>
      </div>

      {data.summary && (
        <div>
          <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1 border-b border-border pb-1">Summary</h3>
          <p className="text-muted-foreground text-xs">{data.summary}</p>
        </div>
      )}

      {data.skills.length > 0 && (
        <div>
          <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1 border-b border-border pb-1">Skills</h3>
          <p className="text-muted-foreground text-xs">{data.skills.join(" • ")}</p>
        </div>
      )}

      {data.experience.some((e) => e.title) && (
        <div>
          <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1 border-b border-border pb-1">Experience</h3>
          {data.experience.filter((e) => e.title).map((exp, i) => (
            <div key={i} className="mb-2">
              <p className="font-medium text-foreground text-xs">{exp.title} at {exp.company}</p>
              <p className="text-muted-foreground text-xs">{exp.duration}</p>
              {exp.description && <p className="text-muted-foreground text-xs mt-0.5">{exp.description}</p>}
            </div>
          ))}
        </div>
      )}

      {data.education.some((e) => e.degree) && (
        <div>
          <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-1 border-b border-border pb-1">Education</h3>
          {data.education.filter((e) => e.degree).map((edu, i) => (
            <div key={i} className="mb-1">
              <p className="font-medium text-foreground text-xs">{edu.degree}</p>
              <p className="text-muted-foreground text-xs">{edu.institution} — {edu.year}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function generateResumeHTML(data: ResumeData, style: string) {
  const accentColor = style === "modern" ? "#6366f1" : style === "creative" ? "#0d9488" : "#1e293b";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.fullName} - Resume</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; }
    h1 { color: ${accentColor}; margin: 0; font-size: 28px; }
    h2 { color: ${accentColor}; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid ${accentColor}; padding-bottom: 4px; margin-top: 20px; }
    .contact { color: #666; font-size: 13px; margin-top: 4px; }
    .entry { margin-bottom: 10px; }
    .entry-title { font-weight: 600; }
    .entry-sub { color: #666; font-size: 13px; }
    .skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill { background: ${accentColor}15; color: ${accentColor}; padding: 3px 10px; border-radius: 12px; font-size: 12px; }
  </style></head><body>
  <div style="text-align:center"><h1>${data.fullName}</h1>
  <p class="contact">${[data.email, data.phone, data.location].filter(Boolean).join(" • ")}</p></div>
  ${data.summary ? `<h2>Summary</h2><p>${data.summary}</p>` : ""}
  ${data.skills.length > 0 ? `<h2>Skills</h2><div class="skills">${data.skills.map((s) => `<span class="skill">${s}</span>`).join("")}</div>` : ""}
  ${data.experience.some((e) => e.title) ? `<h2>Experience</h2>${data.experience.filter((e) => e.title).map((e) => `<div class="entry"><div class="entry-title">${e.title} — ${e.company}</div><div class="entry-sub">${e.duration}</div>${e.description ? `<p>${e.description}</p>` : ""}</div>`).join("")}` : ""}
  ${data.education.some((e) => e.degree) ? `<h2>Education</h2>${data.education.filter((e) => e.degree).map((e) => `<div class="entry"><div class="entry-title">${e.degree}</div><div class="entry-sub">${e.institution} — ${e.year}</div></div>`).join("")}` : ""}
  </body></html>`;
}

export default ResumeBuilder;
