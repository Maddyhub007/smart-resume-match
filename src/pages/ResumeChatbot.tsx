import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, FileText, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STEPS_ORDER = ["greeting", "email", "phone", "location", "summary", "experience", "education", "skills", "projects", "complete"];

const ResumeChatbot = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! 👋 I'm your **AI Resume Assistant**. I'll help you build a professional, ATS-optimized resume through a simple conversation.\n\nLet's start — what's your **full name**?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("greeting");
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});
  const [resumeGenerated, setResumeGenerated] = useState(false);
  const [generatedResumeId, setGeneratedResumeId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
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
        if (userMessage.toLowerCase() !== "done") {
          newData.experience = (newData.experience || "") + "\n" + userMessage;
          setCollectedData(newData);
          try {
            const { data, error } = await supabase.functions.invoke("resume-chatbot", {
              body: { messages: [...messages, { role: "user", content: userMessage }].map((m) => ({ role: m.role, content: m.content })), currentStep: "experience", collectedData: newData },
            });
            if (error) throw error;
            setMessages((prev) => [...prev, { role: "assistant", content: data.message || "Great experience! Add another role or type **'done'** to continue." }]);
          } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Nice! Add another role or type **'done'** to move on." }]);
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
            setMessages((prev) => [...prev, { role: "assistant", content: data.message || "Got it! Add another or type **'done'**." }]);
          } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Added! Type **'done'** to continue or add more." }]);
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
          setMessages((prev) => [...prev, { role: "assistant", content: "Got it! Add another project or type **'done'** to finish." }]);
          setLoading(false);
          return;
        }
        break;
    }

    setCollectedData(newData);

    const currentIndex = STEPS_ORDER.indexOf(currentStep);
    let nextStep = STEPS_ORDER[currentIndex + 1];
    if ((currentStep === "experience" || currentStep === "education" || currentStep === "projects") && (userMessage.toLowerCase() === "done" || userMessage.toLowerCase() === "skip")) {
      nextStep = STEPS_ORDER[currentIndex + 1];
    }

    if (nextStep === "complete") {
      setMessages((prev) => [...prev, { role: "assistant", content: "✨ Perfect! I have all your information. Let me craft your professional resume..." }]);
      setCurrentStep("complete");

      try {
        const { data, error } = await supabase.functions.invoke("resume-chatbot", {
          body: { messages: [], currentStep: "complete", collectedData: newData },
        });
        if (error) throw error;

        if (data.type === "resume_complete" && data.resumeData) {
          let savedId: string | null = null;
          if (user) {
            // Normalize the resume data to match ResumeBuilder format
            const normalizedData = {
              fullName: data.resumeData.personalInfo?.fullName || newData.fullName || "",
              email: data.resumeData.personalInfo?.email || newData.email || "",
              phone: data.resumeData.personalInfo?.phone || newData.phone || "",
              location: data.resumeData.personalInfo?.location || newData.location || "",
              summary: data.resumeData.summary || "",
              skills: data.resumeData.skills || [],
              socialLinks: [{ platform: "LinkedIn", url: "" }],
              experience: (data.resumeData.experience || []).map((e: any) => ({
                title: e.title || "",
                company: e.company || "",
                duration: e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : e.duration || "",
                description: e.description || "",
              })),
              education: (data.resumeData.education || []).map((e: any) => ({
                degree: e.degree || "",
                institution: e.institution || "",
                year: e.year || "",
              })),
              achievements: [{ title: "", description: "" }],
              projects: data.resumeData.projects?.length
                ? data.resumeData.projects.map((p: any) => ({
                    name: p.name || p.title || "",
                    description: p.description || "",
                    tech: p.tech || p.technologies || "",
                    url: p.url || "",
                  }))
                : [{ name: "", description: "", tech: "", url: "" }],
              templateStyle: "modern",
            };

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
            { role: "assistant", content: data.message + "\n\nClick **Edit in Resume Builder** to customize your resume, change templates, and download as PDF." },
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      const fallbacks: Record<string, string> = {
        email: "What's your **email address**?",
        phone: "What's your **phone number**?",
        location: "Where are you based? (City, Country)",
        summary: "Write a brief **professional summary** (2-3 sentences).",
        experience: "Let's add your **work experience**. Describe your roles and type **'done'** when finished.",
        education: "Now your **education**. Share your degrees and type **'done'** when finished.",
        skills: "List your **key skills** separated by commas.",
        projects: "Do you have any **projects** to showcase? Describe them in the format:\n\n**Project Name** - Description (Tech stack)\n\nType **'done'** when finished or **'skip'** to skip.",
      };
      setMessages((prev) => [...prev, { role: "assistant", content: `Got it! ${fallbacks[nextStep] || ""}` }]);
    }

    setLoading(false);
  };

  const progressPercent = Math.round((STEPS_ORDER.indexOf(currentStep) / (STEPS_ORDER.length - 1)) * 100);

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
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progressPercent}% complete</p>
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
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input or action buttons */}
          {resumeGenerated ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
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
                }}
                className="btn-secondary py-3 px-6 flex items-center justify-center gap-2"
              >
                Start Over
              </button>
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
