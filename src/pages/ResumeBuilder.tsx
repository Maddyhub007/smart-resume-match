import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PenTool, Download, Save, Plus, Trash2, Loader2, Link2, Trophy, FolderKanban, AlertCircle, Upload } from "lucide-react";
import Layout from "../components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SocialLink { platform: string; url: string; }
interface Achievement { title: string; description: string; }
interface Project { name: string; description: string; tech: string; url: string; }
interface ResumeData {
  fullName: string; email: string; phone: string; location: string; summary: string;
  skills: string[];
  socialLinks: SocialLink[];
  experience: { title: string; company: string; duration: string; description: string }[];
  education: { degree: string; institution: string; year: string }[];
  achievements: Achievement[];
  projects: Project[];
}

const emptyResume: ResumeData = {
  fullName: "", email: "", phone: "", location: "", summary: "", skills: [],
  socialLinks: [{ platform: "LinkedIn", url: "" }],
  experience: [{ title: "", company: "", duration: "", description: "" }],
  education: [{ degree: "", institution: "", year: "" }],
  achievements: [{ title: "", description: "" }],
  projects: [{ name: "", description: "", tech: "", url: "" }],
};

// ─── Validation ──────────────────────────────────────────────────────────────

type Errors = Record<string, string>;

function validateResume(data: ResumeData): Errors {
  const errors: Errors = {};
  if (!data.fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (/\d/.test(data.fullName)) {
    errors.fullName = "Name should not contain numbers.";
  } else if (/[^a-zA-Z\s.\-']/.test(data.fullName)) {
    errors.fullName = "Name should not contain special characters.";
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = "Name must be at least 2 characters.";
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (data.phone) {
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 12) {
      errors.phone = "Phone must be 10 digits (or 12 with country code).";
    }
  }

  if (data.summary && data.summary.trim().length < 20) {
    errors.summary = "Summary should be at least 20 characters.";
  }

  data.socialLinks.forEach((link, i) => {
    if (link.url && !/^https?:\/\/.+/.test(link.url)) {
      errors[`social_${i}`] = "URL must start with http:// or https://";
    }
  });

  data.projects.forEach((p, i) => {
    if (p.url && !/^https?:\/\/.+/.test(p.url)) {
      errors[`project_url_${i}`] = "URL must start with http:// or https://";
    }
  });

  return errors;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? (
    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  ) : null;

// ─── Templates ───────────────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES = [
  { id: "classic", name: "Classic", description: "Clean & timeless", accent: "#1e293b" },
  { id: "modern", name: "Modern", description: "Bold left stripe", accent: "#6366f1" },
  { id: "executive", name: "Executive", description: "Dark header band", accent: "#0f172a" },
  { id: "creative", name: "Creative", description: "Teal accent lines", accent: "#0d9488" },
  { id: "minimal", name: "Minimal", description: "Pure whitespace", accent: "#374151" },
  { id: "vibrant", name: "Vibrant", description: "Gradient header", accent: "#7c3aed" },
];

// ─── Main Component ──────────────────────────────────────────────────────────

const ResumeBuilder = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("modern");
  const [userResumes, setUserResumes] = useState<any[]>([]);
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData>(emptyResume);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const [templatesRes, resumesRes] = await Promise.all([
      supabase.from("resume_templates").select("*"),
      supabase.from("user_resumes").select("*").eq("user_id", user!.id).order("updated_at", { ascending: false }),
    ]);
    setTemplates(templatesRes.data || []);
    setUserResumes(resumesRes.data || []);

    if (profile) {
      setResumeData((prev) => ({
        ...prev,
        fullName: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
      }));
    }

    const { data: latestResume } = await supabase
      .from("resumes").select("*").eq("user_id", user!.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

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
          ? (latestResume.parsed_experience as any[]).map((e: any) => ({ ...e, description: e.description || "" }))
          : prev.experience,
        education: (latestResume.parsed_education as any[])?.length > 0
          ? latestResume.parsed_education as any[]
          : prev.education,
      }));
    }
    setLoading(false);
  };

  const touch = (key: string) => setTouched((prev) => ({ ...prev, [key]: true }));

  const updateField = <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    const next = { ...resumeData, [key]: value };
    setResumeData(next);
    const newErrors = validateResume(next);
    setErrors(newErrors);
  };

  const loadUserResume = (resume: any) => {
    setEditingResumeId(resume.id);
    const d = resume.resume_data as ResumeData;
    setResumeData({
      ...emptyResume,
      ...d,
      socialLinks: d.socialLinks?.length ? d.socialLinks : emptyResume.socialLinks,
      achievements: d.achievements?.length ? d.achievements : emptyResume.achievements,
      projects: d.projects?.length ? d.projects : emptyResume.projects,
    });
    setSelectedTemplate((resume.resume_data as any)?.templateStyle || "modern");
  };

  const handleSave = async () => {
    const newErrors = validateResume(resumeData);
    setErrors(newErrors);
    // Mark all as touched
    setTouched(Object.fromEntries(Object.keys(newErrors).map((k) => [k, true])));
    if (Object.keys(newErrors).length > 0) {
      toast({ title: "Please fix validation errors before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const resumeJson = { ...resumeData, templateStyle: selectedTemplate } as unknown as import("@/integrations/supabase/types").Json;
    const payload = {
      user_id: user!.id,
      title: `${resumeData.fullName || "Untitled"} - ${selectedTemplate}`,
      resume_data: resumeJson,
    };
    if (editingResumeId) {
      await supabase.from("user_resumes").update(payload).eq("id", editingResumeId);
    } else {
      const { data } = await supabase.from("user_resumes").insert({ ...payload, user_id: user!.id }).select().single();
      if (data) setEditingResumeId(data.id);
    }
    toast({ title: "Resume saved! ✅" });
    setSaving(false);
    fetchData();
  };

  const handleDownload = () => {
    const newErrors = validateResume(resumeData);
    if (Object.keys(newErrors).length > 0) {
      toast({ title: "Please fix validation errors before downloading.", variant: "destructive" });
      return;
    }
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

  // Skills
  const addSkill = () => {
    if (newSkill.trim() && !resumeData.skills.includes(newSkill.trim())) {
      updateField("skills", [...resumeData.skills, newSkill.trim()]);
      setNewSkill("");
    }
  };
  const removeSkill = (skill: string) => updateField("skills", resumeData.skills.filter((s) => s !== skill));

  // Generic list updaters
  const updateExp = (i: number, field: string, value: string) => {
    const exp = resumeData.experience.map((e, idx) => idx === i ? { ...e, [field]: value } : e);
    updateField("experience", exp);
  };
  const removeExp = (i: number) => updateField("experience", resumeData.experience.filter((_, idx) => idx !== i));

  const updateEdu = (i: number, field: string, value: string) => {
    const edu = resumeData.education.map((e, idx) => idx === i ? { ...e, [field]: value } : e);
    updateField("education", edu);
  };
  const removeEdu = (i: number) => updateField("education", resumeData.education.filter((_, idx) => idx !== i));

  const updateSocial = (i: number, field: string, value: string) => {
    const links = resumeData.socialLinks.map((l, idx) => idx === i ? { ...l, [field]: value } : l);
    updateField("socialLinks", links);
  };
  const removeSocial = (i: number) => updateField("socialLinks", resumeData.socialLinks.filter((_, idx) => idx !== i));

  const updateAchievement = (i: number, field: string, value: string) => {
    const ach = resumeData.achievements.map((a, idx) => idx === i ? { ...a, [field]: value } : a);
    updateField("achievements", ach);
  };
  const removeAchievement = (i: number) => updateField("achievements", resumeData.achievements.filter((_, idx) => idx !== i));

  const updateProject = (i: number, field: string, value: string) => {
    const proj = resumeData.projects.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    updateField("projects", proj);
  };
  const removeProject = (i: number) => updateField("projects", resumeData.projects.filter((_, idx) => idx !== i));

  // ─── Import from uploaded resume ─────────────────────────────────────────
  const [importing, setImporting] = useState(false);

  const handleImportResume = useCallback(async () => {
    if (!user) return;
    setImporting(true);
    try {
      const { data: latestResume } = await supabase
        .from("resumes").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!latestResume || !latestResume.parsed_skills?.length) {
        toast({ title: "No parsed resume found. Upload and parse a resume first.", variant: "destructive" });
        setImporting(false);
        return;
      }

      setResumeData({
        ...emptyResume,
        fullName: latestResume.parsed_name || "",
        email: latestResume.parsed_email || "",
        phone: latestResume.parsed_phone || "",
        location: latestResume.parsed_location || "",
        summary: latestResume.parsed_summary || "",
        skills: latestResume.parsed_skills || [],
        experience: (latestResume.parsed_experience as any[])?.length > 0
          ? (latestResume.parsed_experience as any[]).map((e: any) => ({ ...e, description: e.description || "" }))
          : emptyResume.experience,
        education: (latestResume.parsed_education as any[])?.length > 0
          ? latestResume.parsed_education as any[]
          : emptyResume.education,
      });
      setErrors({});
      setTouched({});
      toast({ title: "Resume data imported! ✅ Edit and customize below." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
    setImporting(false);
  }, [user]);

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  const errorCount = Object.keys(errors).length;

  return (
    <Layout>
      <div className="py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-6xl">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="section-title mb-2 flex items-center gap-3">
                <PenTool className="w-7 h-7 sm:w-8 sm:h-8 text-primary" /> Resume Builder
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">Create ATS-friendly resumes with validation</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {errorCount > 0 && (
                <span className="text-xs text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errorCount} error{errorCount > 1 ? "s" : ""}
                </span>
              )}
              <button onClick={handleImportResume} disabled={importing} className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import Resume
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              <button onClick={handleDownload} className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>

          {/* Saved resumes */}
          {userResumes.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-foreground mb-3">Your Saved Resumes</h3>
              <div className="flex flex-wrap gap-3">
                {userResumes.map((r) => (
                  <button key={r.id} onClick={() => loadUserResume(r)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${editingResumeId === r.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                    {r.title}
                  </button>
                ))}
                <button onClick={() => { setEditingResumeId(null); setResumeData(emptyResume); setErrors({}); setTouched({}); }}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-border text-muted-foreground hover:border-primary flex items-center gap-1">
                  <Plus className="w-4 h-4" /> New
                </button>
              </div>
            </div>
          )}

          {/* Template selection */}
          <div className="mb-8">
            <h3 className="font-semibold text-foreground mb-3">Choose Template</h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
              {BUILT_IN_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`card-elevated p-4 text-center transition-all hover:scale-105 ${selectedTemplate === t.id ? "border-primary ring-2 ring-primary/25" : ""}`}>
                  {/* Mini preview swatch */}
                  <div className="w-full h-10 rounded-lg mb-2 flex flex-col gap-1 p-1.5 overflow-hidden"
                    style={{ background: t.id === "executive" ? "#0f172a" : t.id === "vibrant" ? "linear-gradient(135deg,#7c3aed,#6366f1)" : "#f8fafc", border: `2px solid ${t.accent}` }}>
                    <div className="w-full h-1.5 rounded-full" style={{ background: t.accent, opacity: 0.9 }} />
                    <div className="w-2/3 h-1 rounded-full bg-gray-300 opacity-60" />
                  </div>
                  <p className="font-semibold text-foreground text-xs">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
            {/* ── Editor ── */}
            <div className="space-y-5 sm:space-y-6">

              {/* Personal Info */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4">Personal Info</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2">
                    <input
                      value={resumeData.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      onBlur={() => touch("fullName")}
                      placeholder="Full Name *"
                      className={`input-field w-full ${touched.fullName && errors.fullName ? "border-destructive" : ""}`}
                    />
                    {touched.fullName && <FieldError msg={errors.fullName} />}
                  </div>
                  <div>
                    <input
                      value={resumeData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      onBlur={() => touch("email")}
                      placeholder="Email"
                      type="email"
                      className={`input-field w-full ${touched.email && errors.email ? "border-destructive" : ""}`}
                    />
                    {touched.email && <FieldError msg={errors.email} />}
                  </div>
                  <div>
                    <input
                      value={resumeData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      onBlur={() => touch("phone")}
                      placeholder="Phone (10 digits)"
                      type="tel"
                      className={`input-field w-full ${touched.phone && errors.phone ? "border-destructive" : ""}`}
                    />
                    {touched.phone && <FieldError msg={errors.phone} />}
                  </div>
                  <input value={resumeData.location} onChange={(e) => updateField("location", e.target.value)}
                    placeholder="Location" className="input-field sm:col-span-2" />
                </div>
              </div>

              {/* Social Links */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" /> Social Links
                </h3>
                {resumeData.socialLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 mb-3">
                    <select
                      value={link.platform}
                      onChange={(e) => updateSocial(i, "platform", e.target.value)}
                      className="input-field w-36 flex-shrink-0"
                    >
                      {["LinkedIn", "GitHub", "Portfolio", "Twitter", "Behance", "Dribbble", "Other"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <div className="flex-1">
                      <input
                        value={link.url}
                        onChange={(e) => updateSocial(i, "url", e.target.value)}
                        onBlur={() => touch(`social_${i}`)}
                        placeholder="https://..."
                        className={`input-field w-full ${touched[`social_${i}`] && errors[`social_${i}`] ? "border-destructive" : ""}`}
                      />
                      {touched[`social_${i}`] && <FieldError msg={errors[`social_${i}`]} />}
                    </div>
                    <button onClick={() => removeSocial(i)} className="text-muted-foreground hover:text-destructive p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => updateField("socialLinks", [...resumeData.socialLinks, { platform: "LinkedIn", url: "" }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Link
                </button>
              </div>

              {/* Summary */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4">Professional Summary</h3>
                <textarea
                  value={resumeData.summary}
                  onChange={(e) => updateField("summary", e.target.value)}
                  onBlur={() => touch("summary")}
                  placeholder="2–3 sentences about your professional background..."
                  className={`input-field min-h-[100px] w-full ${touched.summary && errors.summary ? "border-destructive" : ""}`}
                />
                {touched.summary && <FieldError msg={errors.summary} />}
                <p className="text-xs text-muted-foreground mt-1">{resumeData.summary.length} characters</p>
              </div>

              {/* Skills */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4">Skills</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {resumeData.skills.map((s) => (
                    <span key={s} className="skill-tag flex items-center gap-1">
                      {s}
                      <button onClick={() => removeSkill(s)} className="hover:text-destructive ml-1"><Trash2 className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    placeholder="Add skill & press Enter" className="input-field flex-1" />
                  <button onClick={addSkill} className="btn-secondary text-sm py-2 px-3"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Experience */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4">Experience</h3>
                {resumeData.experience.map((exp, i) => (
                  <div key={i} className="space-y-3 mb-4 pb-4 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry {i + 1}</span>
                      {resumeData.experience.length > 1 && (
                        <button onClick={() => removeExp(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input value={exp.title} onChange={(e) => updateExp(i, "title", e.target.value)} placeholder="Job Title" className="input-field" />
                      <input value={exp.company} onChange={(e) => updateExp(i, "company", e.target.value)} placeholder="Company" className="input-field" />
                      <input value={exp.duration} onChange={(e) => updateExp(i, "duration", e.target.value)} placeholder="e.g. Jan 2022 – Present" className="input-field sm:col-span-2" />
                    </div>
                    <textarea value={exp.description} onChange={(e) => updateExp(i, "description", e.target.value)}
                      placeholder="Key responsibilities & achievements..." className="input-field min-h-[60px] w-full" />
                  </div>
                ))}
                <button onClick={() => updateField("experience", [...resumeData.experience, { title: "", company: "", duration: "", description: "" }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add Experience</button>
              </div>

              {/* Education */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4">Education</h3>
                {resumeData.education.map((edu, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry {i + 1}</span>
                      {resumeData.education.length > 1 && (
                        <button onClick={() => removeEdu(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} placeholder="Degree / Certification" className="input-field" />
                      <input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} placeholder="Institution" className="input-field" />
                      <input value={edu.year} onChange={(e) => updateEdu(i, "year", e.target.value)} placeholder="Year / Range" className="input-field" />
                    </div>
                  </div>
                ))}
                <button onClick={() => updateField("education", [...resumeData.education, { degree: "", institution: "", year: "" }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"><Plus className="w-4 h-4" /> Add Education</button>
              </div>

              {/* Achievements */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Achievements
                </h3>
                {resumeData.achievements.map((ach, i) => (
                  <div key={i} className="space-y-2 mb-4 pb-4 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Achievement {i + 1}</span>
                      {resumeData.achievements.length > 1 && (
                        <button onClick={() => removeAchievement(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <input value={ach.title} onChange={(e) => updateAchievement(i, "title", e.target.value)}
                      placeholder="e.g. Won National Hackathon 2024" className="input-field w-full" />
                    <textarea value={ach.description} onChange={(e) => updateAchievement(i, "description", e.target.value)}
                      placeholder="Brief description..." className="input-field min-h-[50px] w-full" />
                  </div>
                ))}
                <button onClick={() => updateField("achievements", [...resumeData.achievements, { title: "", description: "" }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add Achievement</button>
              </div>

              {/* Projects */}
              <div className="card-elevated p-4 sm:p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-accent" /> Projects
                </h3>
                {resumeData.projects.map((proj, i) => (
                  <div key={i} className="space-y-2 mb-4 pb-4 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project {i + 1}</span>
                      {resumeData.projects.length > 1 && (
                        <button onClick={() => removeProject(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input value={proj.name} onChange={(e) => updateProject(i, "name", e.target.value)}
                        placeholder="Project Name" className="input-field" />
                      <input value={proj.tech} onChange={(e) => updateProject(i, "tech", e.target.value)}
                        placeholder="Tech stack (React, Node...)" className="input-field" />
                    </div>
                    <textarea value={proj.description} onChange={(e) => updateProject(i, "description", e.target.value)}
                      placeholder="What it does, your role, impact..." className="input-field min-h-[50px] w-full" />
                    <div>
                      <input value={proj.url} onChange={(e) => updateProject(i, "url", e.target.value)}
                        onBlur={() => touch(`project_url_${i}`)}
                        placeholder="https://github.com/..." className={`input-field w-full ${touched[`project_url_${i}`] && errors[`project_url_${i}`] ? "border-destructive" : ""}`} />
                      {touched[`project_url_${i}`] && <FieldError msg={errors[`project_url_${i}`]} />}
                    </div>
                  </div>
                ))}
                <button onClick={() => updateField("projects", [...resumeData.projects, { name: "", description: "", tech: "", url: "" }])}
                  className="text-sm text-primary hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add Project</button>
              </div>
            </div>

            {/* ── Preview ── */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="card-elevated p-4 sm:p-6 bg-card overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Live Preview</span>
                  <span className="text-xs font-semibold text-primary capitalize">{selectedTemplate}</span>
                </div>
                <div className="overflow-y-auto max-h-[80vh] pr-1">
                  <ResumePreview data={resumeData} style={selectedTemplate} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// ─── Preview Component ────────────────────────────────────────────────────────

const ResumePreview = ({ data, style }: { data: ResumeData; style: string }) => {
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === style) || BUILT_IN_TEMPLATES[0];

  const Header = () => {
    if (style === "executive") return (
      <div className="p-4 mb-3 rounded-lg" style={{ background: "#0f172a" }}>
        <h2 className="text-lg font-bold text-white">{data.fullName || "Your Name"}</h2>
        <p className="text-gray-300 text-xs mt-1">{[data.email, data.phone, data.location].filter(Boolean).join(" • ")}</p>
        {data.socialLinks.filter((l) => l.url).map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            className="text-blue-300 text-xs mr-3 hover:underline">{l.platform}</a>
        ))}
      </div>
    );
    if (style === "vibrant") return (
      <div className="p-4 mb-3 rounded-lg" style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}>
        <h2 className="text-lg font-bold text-white">{data.fullName || "Your Name"}</h2>
        <p className="text-purple-100 text-xs mt-1">{[data.email, data.phone, data.location].filter(Boolean).join(" • ")}</p>
        {data.socialLinks.filter((l) => l.url).map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
            className="text-purple-200 text-xs mr-3 hover:underline">{l.platform}</a>
        ))}
      </div>
    );
    return (
      <div className={`text-center mb-3 ${style === "modern" ? "border-l-4 pl-3 text-left" : style === "creative" ? "border-l-4 pl-3 text-left" : ""}`}
        style={{ borderColor: style === "modern" || style === "creative" ? tpl.accent : "transparent" }}>
        <h2 className="text-lg font-bold" style={{ color: tpl.accent }}>{data.fullName || "Your Name"}</h2>
        <p className="text-gray-500 text-xs mt-0.5">{[data.email, data.phone, data.location].filter(Boolean).join(" • ") || "Contact info"}</p>
        <div className="flex flex-wrap gap-x-3 mt-0.5 justify-center" style={{ justifyContent: style === "modern" || style === "creative" ? "flex-start" : "center" }}>
          {data.socialLinks.filter((l) => l.url).map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
              className="text-xs hover:underline" style={{ color: tpl.accent }}>{l.platform}</a>
          ))}
        </div>
      </div>
    );
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <h3 className="text-xs font-bold uppercase tracking-widest mb-1.5 pb-0.5 border-b" style={{ color: tpl.accent, borderColor: tpl.accent + "44" }}>{title}</h3>
  );

  return (
    <div className="space-y-3 text-xs font-[sans-serif]">
      <Header />
      {data.summary && <div><SectionTitle title="Summary" /><p className="text-gray-600 leading-relaxed">{data.summary}</p></div>}
      {data.skills.length > 0 && <div><SectionTitle title="Skills" /><p className="text-gray-600">{data.skills.join(" • ")}</p></div>}
      {data.experience.some((e) => e.title) && (
        <div>
          <SectionTitle title="Experience" />
          {data.experience.filter((e) => e.title).map((exp, i) => (
            <div key={i} className="mb-2">
              <p className="font-semibold text-gray-800">{exp.title} <span className="text-gray-500 font-normal">@ {exp.company}</span></p>
              <p className="text-gray-400">{exp.duration}</p>
              {exp.description && <p className="text-gray-600 mt-0.5">{exp.description}</p>}
            </div>
          ))}
        </div>
      )}
      {data.education.some((e) => e.degree) && (
        <div>
          <SectionTitle title="Education" />
          {data.education.filter((e) => e.degree).map((edu, i) => (
            <div key={i} className="mb-1">
              <p className="font-semibold text-gray-800">{edu.degree}</p>
              <p className="text-gray-500">{edu.institution} — {edu.year}</p>
            </div>
          ))}
        </div>
      )}
      {data.achievements.some((a) => a.title) && (
        <div>
          <SectionTitle title="Achievements" />
          {data.achievements.filter((a) => a.title).map((ach, i) => (
            <div key={i} className="mb-1">
              <p className="font-semibold text-gray-800">🏆 {ach.title}</p>
              {ach.description && <p className="text-gray-600">{ach.description}</p>}
            </div>
          ))}
        </div>
      )}
      {data.projects.some((p) => p.name) && (
        <div>
          <SectionTitle title="Projects" />
          {data.projects.filter((p) => p.name).map((proj, i) => (
            <div key={i} className="mb-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800">{proj.name}</p>
                {proj.url && <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: tpl.accent }}>🔗 Link</a>}
              </div>
              {proj.tech && <p className="text-gray-400 italic">{proj.tech}</p>}
              {proj.description && <p className="text-gray-600">{proj.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── HTML Download Generator ──────────────────────────────────────────────────

function generateResumeHTML(data: ResumeData, style: string) {
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === style) || BUILT_IN_TEMPLATES[0];
  const ac = tpl.accent;
  const isExec = style === "executive";
  const isVibrant = style === "vibrant";
  const isModern = style === "modern";
  const isCreative = style === "creative";

  const headerBg = isExec ? "#0f172a" : isVibrant ? "linear-gradient(135deg,#7c3aed,#6366f1)" : "transparent";
  const headerColor = isExec || isVibrant ? "#fff" : ac;
  const leftBorder = isModern || isCreative ? `border-left: 4px solid ${ac}; padding-left: 16px;` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.fullName} - Resume</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
    .header { ${headerBg !== "transparent" ? `background: ${headerBg}; padding: 20px; border-radius: 8px; margin-bottom: 20px;` : leftBorder} }
    .header h1 { color: ${headerColor}; margin: 0; font-size: 26px; }
    .contact { color: ${isExec || isVibrant ? "#ccc" : "#666"}; font-size: 12px; margin-top: 4px; }
    .social-links a { color: ${isExec ? "#93c5fd" : isVibrant ? "#c4b5fd" : ac}; font-size: 12px; margin-right: 12px; text-decoration: none; }
    h2 { color: ${ac}; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid ${ac}44; padding-bottom: 3px; margin-top: 18px; }
    .entry { margin-bottom: 10px; }
    .entry-title { font-weight: 600; }
    .entry-sub { color: #666; font-size: 12px; }
    .skills { color: #444; }
    .project-link { color: ${ac}; font-size: 11px; text-decoration: none; }
  </style></head><body>
  <div class="header">
    <h1>${data.fullName}</h1>
    <p class="contact">${[data.email, data.phone, data.location].filter(Boolean).join(" • ")}</p>
    ${data.socialLinks.filter((l) => l.url).length > 0 ? `<div class="social-links">${data.socialLinks.filter((l) => l.url).map((l) => `<a href="${l.url}" target="_blank">${l.platform}</a>`).join("")}</div>` : ""}
  </div>
  ${data.summary ? `<h2>Summary</h2><p>${data.summary}</p>` : ""}
  ${data.skills.length > 0 ? `<h2>Skills</h2><p class="skills">${data.skills.join(" • ")}</p>` : ""}
  ${data.experience.some((e) => e.title) ? `<h2>Experience</h2>${data.experience.filter((e) => e.title).map((e) => `<div class="entry"><div class="entry-title">${e.title} — ${e.company}</div><div class="entry-sub">${e.duration}</div>${e.description ? `<p>${e.description}</p>` : ""}</div>`).join("")}` : ""}
  ${data.education.some((e) => e.degree) ? `<h2>Education</h2>${data.education.filter((e) => e.degree).map((e) => `<div class="entry"><div class="entry-title">${e.degree}</div><div class="entry-sub">${e.institution} — ${e.year}</div></div>`).join("")}` : ""}
  ${data.achievements.some((a) => a.title) ? `<h2>Achievements</h2>${data.achievements.filter((a) => a.title).map((a) => `<div class="entry"><div class="entry-title">🏆 ${a.title}</div>${a.description ? `<p>${a.description}</p>` : ""}</div>`).join("")}` : ""}
  ${data.projects.some((p) => p.name) ? `<h2>Projects</h2>${data.projects.filter((p) => p.name).map((p) => `<div class="entry"><div class="entry-title">${p.name}${p.url ? ` <a class="project-link" href="${p.url}" target="_blank">🔗</a>` : ""}</div>${p.tech ? `<div class="entry-sub">${p.tech}</div>` : ""}${p.description ? `<p>${p.description}</p>` : ""}</div>`).join("")}` : ""}
  </body></html>`;
}

export default ResumeBuilder;
