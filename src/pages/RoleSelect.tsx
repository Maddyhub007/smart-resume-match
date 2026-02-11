import { useNavigate } from "react-router-dom";
import { User, Briefcase, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const RoleSelect = () => {
  const navigate = useNavigate();
  const { user, role, setUserRole } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) {
    navigate("/auth");
    return null;
  }
  if (role) {
    navigate(role === "recruiter" ? "/recruiter" : "/dashboard");
    return null;
  }

  const handleSelect = async (selectedRole: "candidate" | "recruiter") => {
    setLoading(true);
    try {
      await setUserRole(selectedRole);
      toast({ title: `Welcome as a ${selectedRole}!` });
      navigate(selectedRole === "recruiter" ? "/recruiter" : "/upload");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">How will you use ResumeAI?</h1>
        <p className="text-muted-foreground mb-10">Choose your role to get started</p>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => handleSelect("candidate")}
            disabled={loading}
            className="card-elevated p-8 text-left hover:border-primary/50 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <User className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Job Seeker</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Upload resumes, get AI analysis, find matching jobs, and build ATS-friendly resumes.
            </p>
            <span className="text-primary text-sm font-medium flex items-center gap-1">
              Get Started <ArrowRight className="w-4 h-4" />
            </span>
          </button>

          <button
            onClick={() => handleSelect("recruiter")}
            disabled={loading}
            className="card-elevated p-8 text-left hover:border-accent/50 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <Briefcase className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Recruiter</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Post jobs, view applicants, screen resumes with AI, and schedule interviews via chat.
            </p>
            <span className="text-accent text-sm font-medium flex items-center gap-1">
              Get Started <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;
