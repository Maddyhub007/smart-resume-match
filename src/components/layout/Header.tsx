import { Link, useLocation } from "react-router-dom";
import { FileText, LayoutDashboard, Briefcase, User, Menu, X, MessageSquare, PenTool, Users, LogIn } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, role, signOut } = useAuth();

  const candidateNav = [
    { path: "/", label: "Home", icon: null },
    { path: "/upload", label: "Upload Resume", icon: FileText },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/jobs", label: "Jobs", icon: Briefcase },
    { path: "/resume-builder", label: "Resume Builder", icon: PenTool },
    { path: "/messages", label: "Messages", icon: MessageSquare },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const recruiterNav = [
    { path: "/", label: "Home", icon: null },
    { path: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
    { path: "/recruiter/post-job", label: "Post Job", icon: Briefcase },
    { path: "/messages", label: "Messages", icon: MessageSquare },
    { path: "/profile", label: "Profile", icon: User },
  ];

  const navItems = !user ? [{ path: "/", label: "Home", icon: null }] :
    role === "recruiter" ? recruiterNav : candidateNav;

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors">
              ResumeAI
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">{role}</span>
                <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">Sign Out</button>
              </>
            ) : (
              <Link to="/auth" className="btn-primary text-sm py-2 px-4">
                <LogIn className="w-4 h-4" /> Sign In
              </Link>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-foreground" /> : <Menu className="w-6 h-6 text-foreground" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {Icon && <Icon className="w-5 h-5" />}
                    {item.label}
                  </Link>
                );
              })}
              {user ? (
                <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="text-sm text-muted-foreground hover:text-foreground px-4 py-3 text-left">Sign Out</button>
              ) : (
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)} className="btn-primary text-sm py-3 mt-2">Sign In</Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
