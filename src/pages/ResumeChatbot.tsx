import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, FileText, Sparkles, User, Download, FileType, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  quickOptions?: string[];
}

const STEPS_ORDER = ["greeting", "email", "phone", "location", "summary", "experience", "education", "skills", "projects", "complete"];

const QUICK_OPTIONS: Record<string, string[]> = {
  greeting: [],
  email: [],
  phone: [],
  location: ["Bangalore, India", "Hyderabad, India", "Mumbai, India", "Delhi, India", "Chennai, India", "Remote"],
  summary: [
    "I'm a software developer with experience in web technologies, looking for challenging roles.",
    "Recent graduate passionate about technology and eager to start my career in software development.",
    "Experienced professional with strong analytical and problem-solving skills seeking growth opportunities.",
  ],
  experience: ["Fresher - No experience", "done"],
  education: ["done"],
  skills: [
    "JavaScript, React, Node.js, HTML, CSS",
    "Python, Django, SQL, Git, AWS",
    "Java, Spring Boot, MySQL, Docker, Kubernetes",
    "C++, Data Structures, Algorithms, Problem Solving",
  ],
  projects: ["skip", "done"],
};

// Resume HTML generator (shared with ResumeBuilder)
function generateResumeHTML(data: any) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.fullName || "Resume"}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
    .header { border-left: 4px solid #6366f1; padding-left: 16px; }
    .header h1 { color: #6366f1; margin: 0; font-size: 26px; }
    .contact { color: #666; font-size: 12px; margin-top: 4px; }
    h2 { color: #6366f1; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #6366f144; padding-bottom: 3px; margin-top: 18px; }
    .entry { margin-bottom: 10px; }
    .entry-title { font-weight: 600; }
    .entry-sub { color: #666; font-size: 12px; }
    .skills { color: #444; }
    .project-link { color: #6366f1; font-size: 11px; text-decoration: none; }
  </style></head><body>
  <div class="header">
    <h1>${data.fullName || ""}</h1>
    <p class="contact">${[data.email, data.phone, data.location].filter(Boolean).join(" • ")}</p>
  </div>
  ${data.summary ? `<h2>Summary</h2><p>${data.summary}</p>` : ""}
  ${data.skills?.length > 0 ? `<h2>Skills</h2><p class="skills">${(Array.isArray(data.skills) ? data.skills : data.skills.split(",")).join(" • ")}</p>` : ""}
  ${data.experience?.some?.((e: any) => e.title) ? `<h2>Experience</h2>${data.experience.filter((e: any) => e.title).map((e: any) => `<div class="entry"><div class="entry-title">${e.title} — ${e.company}</div><div class="entry-sub">${e.duration || (e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : "")}</div>${e.description ? `<p>${e.description}</p>` : ""}</div>`).join("")}` : ""}
  ${data.education?.some?.((e: any) => e.degree) ? `<h2>Education</h2>${data.education.filter((e: any) => e.degree).map((e: any) => `<div class="entry"><div class="entry-title">${e.degree}</div><div class="entry-sub">${e.institution} — ${e.year}</div></div>`).join("")}` : ""}
  ${data.projects?.some?.((p: any) => p.name) ? `<h2>Projects</h2>${data.projects.filter((p: any) => p.name).map((p: any) => `<div class="entry"><div class="entry-title">${p.name}${p.url ? ` <a class="project-link" href="${p.url}">🔗</a>` : ""}</div>${p.tech ? `<div class="entry-sub">${p.tech}</div>` : ""}${p.description ? `<p>${p.description}</p>` : ""}</div>`).join("")}` : ""}
  </body></html>`;
}

const ResumeChatbot = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! 👋 I'm your **AI Resume Assistant**. I'll help you build a professional, ATS-optimized resume through a simple conversation.\n\nLet's start — what's your **full name**?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("greeting");
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});
  const [resumeGenerated, setResumeGenerated] = useState(false);
  const [generatedResumeId, setGeneratedResumeId] = useState<string | null>(null);
  const [finalResumeData, setFinalResumeData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleQuickOption = (option: string) => {
    setInput(option);
    // Auto-send for quick options
    setTimeout(() => {
      setInput("");
      processMessage(option);
    }, 100);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    processMessage(userMessage);
  };

  const processMessage = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    const newData = { ...collectedData };
    switch (currentStep) {
      case "greeting": newData.fullName = userMessage; break;
      case "email": newData.email = userMessage; break;
      case "phone": newData.phone = userMessage; break;
      case "location": newData.location = userMessage; break;
      case "summary": newData.summary = userMessage; break;
      case "experience":
        if (userMessage.toLowerCase() === "fresher - no experience" || userMessage.toLowerCase() === "fresher") {
          newData.experience = "Fresher";
          break;
        }
        if (userMessage.toLowerCase() !== "done") {
          newData.experience = (newData.experience || "") + "\n" + userMessage;
          setCollectedData(newData);
          try {
            const { data, error } = await supabase.functions.invoke("resume-chatbot", {
              body: { messages: [...messages, { role: "user", content: userMessage }].map((m) => ({ role: m.role, content: m.content })), currentStep: "experience", collectedData: newData },
            });
            if (error) throw error;
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.message || "Great experience! Add another role or type **'done'** to continue.",
              quickOptions: ["done"],
            }]);
          } catch {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "Nice! Add another role or type **'done'** to move on.",
              quickOptions: ["done"],
            }]);
          }
          setLoading(false);
          return;
        }
        break;
      case "education":
        if (userMessage.toLowerCase() !== "done") {
          newData.education = (newData.education || "") + "\n" + userMessage;
          setCollectedData(newData);
          try {
            const { data, error } = await supabase.functions.invoke("resume-chatbot", {
              body: { messages: [...messages, { role: "user", content: userMessage }].map((m) => ({ role: m.role, content: m.content })), currentStep: "education", collectedData: newData },
            });
            if (error) throw error;
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.message || "Got it! Add another or type **'done'**.",
              quickOptions: ["done"],
            }]);
          } catch {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "Added! Type **'done'** to continue or add more.",
              quickOptions: ["done"],
            }]);
          }
          setLoading(false);
          return;
        }
        break;
      case "skills": newData.skills = userMessage; break;
      case "projects":
        if (userMessage.toLowerCase() !== "done" && userMessage.toLowerCase() !== "skip") {
          newData.projects = (newData.projects || "") + "\n" + userMessage;
          setCollectedData(newData);
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: "Got it! Add another project or type **'done'** to finish.",
            quickOptions: ["done"],
          }]);
          setLoading(false);
          return;
        }
        break;
    }

    setCollectedData(newData);

    const currentIndex = STEPS_ORDER.indexOf(currentStep);
    const nextStep = STEPS_ORDER[currentIndex + 1];

    if (nextStep === "complete") {
      setMessages((prev) => [...prev, { role: "assistant", content: "✨ Perfect! I have all your information. Let me craft your professional resume..." }]);
      setCurrentStep("complete");

      try {
        const { data, error } = await supabase.functions.invoke("resume-chatbot", {
          body: { messages: [], currentStep: "complete", collectedData: newData },
        });
        if (error) throw error;

        if (data.type === "resume_complete" && data.resumeData) {
          const normalizedData = {
            fullName: data.resumeData.personalInfo?.fullName || newData.fullName || "",
            email: data.resumeData.personalInfo?.email || newData.email || "",
            phone: data.resumeData.personalInfo?.phone || newData.phone || "",
            location: data.resumeData.personalInfo?.location || newData.location || "",
            summary: data.resumeData.summary || "",
            skills: data.resumeData.skills || [],
            socialLinks: [{ platform: "LinkedIn", url: "" }],
            experience: (data.resumeData.experience || []).map((e: any) => ({
              title: e.title || "", company: e.company || "",
              duration: e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : e.duration || "",
              description: e.description || "",
            })),
            education: (data.resumeData.education || []).map((e: any) => ({
              degree: e.degree || "", institution: e.institution || "", year: e.year || "",
            })),
            achievements: [{ title: "", description: "" }],
            projects: data.resumeData.projects?.length
              ? data.resumeData.projects.map((p: any) => ({
                  name: p.name || p.title || "", description: p.description || "",
                  tech: p.tech || p.technologies || "", url: p.url || "",
                }))
              : [{ name: "", description: "", tech: "", url: "" }],
            templateStyle: "modern",
          };

          setFinalResumeData(normalizedData);

          let savedId: string | null = null;
          if (user) {
            const resumePayload = {
              user_id: user.id,
              title: `AI Resume - ${newData.fullName || "Untitled"}`,
              resume_data: normalizedData as unknown as import("@/integrations/supabase/types").Json,
            };
            const { data: savedResume } = await supabase.from("user_resumes").insert(resumePayload).select("id").single();
            savedId = savedResume?.id || null;
          }

          setGeneratedResumeId(savedId);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: data.message + "\n\n📥 You can **download your resume** below or **edit it** in the Resume Builder." },
          ]);
          setResumeGenerated(true);
        }
      } catch (e: any) {
        console.error("Resume generation error:", e);
        toast({ title: "Error generating resume", description: e.message, variant: "destructive" });
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, there was an error generating your resume. Please try again." }]);
      }
      setLoading(false);
      return;
    }

    setCurrentStep(nextStep);

    try {
      const { data, error } = await supabase.functions.invoke("resume-chatbot", {
        body: {
          messages: [...messages, { role: "user", content: userMessage }].map((m) => ({ role: m.role, content: m.content })),
          currentStep,
          collectedData: newData,
        },
      });
      if (error) throw error;
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.message,
        quickOptions: QUICK_OPTIONS[nextStep] || [],
      }]);
    } catch {
      const fallbacks: Record<string, string> = {
        email: "What's your **email address**?",
        phone: "What's your **phone number**?",
        location: "Where are you based? (City, Country)",
        summary: "Write a brief **professional summary** (2-3 sentences).",
        experience: "Let's add your **work experience**. Describe your roles and type **'done'** when finished.",
        education: "Now your **education**. Share your degrees and type **'done'** when finished.",
        skills: "List your **key skills** separated by commas.",
        projects: "Any **projects** to showcase? Type **'done'** when finished or **'skip'** to skip.",
      };
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Got it! ${fallbacks[nextStep] || ""}`,
        quickOptions: QUICK_OPTIONS[nextStep] || [],
      }]);
    }

    setLoading(false);
  };

  const handleDownloadPDF = () => {
    const data = finalResumeData || collectedData;
    if (!data.fullName) {
      toast({ title: "No resume data available", variant: "destructive" });
      return;
    }
    const html = generateResumeHTML(data);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1500);
    };
    toast({ title: "Print dialog opened — choose 'Save as PDF'" });
  };

  const handleDownloadDOCX = async () => {
    const data = finalResumeData || collectedData;
    if (!data.fullName) {
      toast({ title: "No resume data available", variant: "destructive" });
      return;
    }

    // Generate a simple DOCX-compatible HTML blob that Word can open
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${data.fullName} Resume</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.5; }
        h1 { color: #2d3748; font-size: 22pt; margin-bottom: 2pt; }
        h2 { color: #4f46e5; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2pt; margin-top: 14pt; }
        .contact { color: #718096; font-size: 10pt; }
        .entry-title { font-weight: bold; }
        .entry-sub { color: #718096; font-size: 10pt; }
        .skills { color: #4a5568; }
      </style></head><body>
      <h1>${data.fullName}</h1>
      <p class="contact">${[data.email, data.phone, data.location].filter(Boolean).join(" | ")}</p>
      ${data.summary ? `<h2>Professional Summary</h2><p>${data.summary}</p>` : ""}
      ${data.skills?.length > 0 ? `<h2>Skills</h2><p class="skills">${(Array.isArray(data.skills) ? data.skills : data.skills.split(",")).join(" • ")}</p>` : ""}
      ${data.experience?.some?.((e: any) => e.title) ? `<h2>Work Experience</h2>${data.experience.filter((e: any) => e.title).map((e: any) => `<p><span class="entry-title">${e.title}</span> — ${e.company}<br/><span class="entry-sub">${e.duration || ""}</span></p>${e.description ? `<p>${e.description}</p>` : ""}`).join("")}` : ""}
      ${data.education?.some?.((e: any) => e.degree) ? `<h2>Education</h2>${data.education.filter((e: any) => e.degree).map((e: any) => `<p><span class="entry-title">${e.degree}</span><br/><span class="entry-sub">${e.institution} — ${e.year}</span></p>`).join("")}` : ""}
      ${data.projects?.some?.((p: any) => p.name) ? `<h2>Projects</h2>${data.projects.filter((p: any) => p.name).map((p: any) => `<p><span class="entry-title">${p.name}</span>${p.tech ? ` (${p.tech})` : ""}</p>${p.description ? `<p>${p.description}</p>` : ""}`).join("")}` : ""}
      </body></html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.fullName || "Resume"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Resume downloaded as DOC file! 📄" });
  };

  const progressPercent = Math.round((STEPS_ORDER.indexOf(currentStep) / (STEPS_ORDER.length - 1)) * 100);

  // Get current quick options
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const currentQuickOptions = lastAssistantMsg?.quickOptions || QUICK_OPTIONS[currentStep] || [];

  return (
    <Layout>
      <div className="py-4 sm:py-6 px-4 h-[calc(100vh-130px)] flex flex-col">
        <div className="container mx-auto max-w-3xl flex flex-col h-full">
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">AI Resume Builder</h1>
                <p className="text-xs text-muted-foreground">Guided conversation to build your perfect resume</p>
              </div>
            </div>
            {/* Step indicator pills */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {STEPS_ORDER.slice(0, -1).map((step, i) => {
                const stepIndex = STEPS_ORDER.indexOf(currentStep);
                const isDone = i < stepIndex;
                const isCurrent = i === stepIndex;
                return (
                  <div
                    key={step}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step === "greeting" ? "Name" : step.charAt(0).toUpperCase() + step.slice(1)}
                  </div>
                );
              })}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>p]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick options */}
          {!resumeGenerated && !loading && currentQuickOptions.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-3">
              {currentQuickOptions.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickOption(option)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Input or action buttons */}
          {resumeGenerated ? (
            <div className="space-y-3 pt-4 border-t border-border">
              {/* Download buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleDownloadDOCX}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <FileType className="w-4 h-4" />
                  Download DOCX
                </button>
              </div>
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => navigate("/resume-builder", { state: { loadResumeId: generatedResumeId } })}
                  className="btn-primary py-3 px-6 flex items-center justify-center gap-2 flex-1"
                >
                  <FileText className="w-5 h-5" />
                  Edit in Resume Builder
                </button>
                <button
                  onClick={() => {
                    setMessages([{ role: "assistant", content: "Hi! 👋 Let's build another resume. What's your **full name**?" }]);
                    setCurrentStep("greeting");
                    setCollectedData({});
                    setResumeGenerated(false);
                    setGeneratedResumeId(null);
                    setFinalResumeData(null);
                  }}
                  className="btn-secondary py-3 px-6 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start Over
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder={
                  currentStep === "experience" || currentStep === "education" || currentStep === "projects"
                    ? "Type your answer or 'done' to continue..."
                    : "Type your answer..."
                }
                className="input-field flex-1"
                disabled={loading}
              />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="btn-primary py-3 px-4">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ResumeChatbot;
