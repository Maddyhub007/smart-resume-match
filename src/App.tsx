import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import RoleSelect from "./pages/RoleSelect";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Profile from "./pages/Profile";
import ResumeBuilder from "./pages/ResumeBuilder";
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import PostJob from "./pages/recruiter/PostJob";
import Applicants from "./pages/recruiter/Applicants";
import Chat from "./pages/Chat";
import ChatList from "./pages/ChatList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/role-select" element={<RoleSelect />} />

            {/* Candidate routes */}
            <Route path="/upload" element={<ProtectedRoute requiredRole="candidate"><Upload /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute requiredRole="candidate"><Dashboard /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute requiredRole="candidate"><Jobs /></ProtectedRoute>} />
            <Route path="/resume-builder" element={<ProtectedRoute requiredRole="candidate"><ResumeBuilder /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            {/* Recruiter routes */}
            <Route path="/recruiter" element={<ProtectedRoute requiredRole="recruiter"><RecruiterDashboard /></ProtectedRoute>} />
            <Route path="/recruiter/post-job" element={<ProtectedRoute requiredRole="recruiter"><PostJob /></ProtectedRoute>} />
            <Route path="/recruiter/applicants/:jobId" element={<ProtectedRoute requiredRole="recruiter"><Applicants /></ProtectedRoute>} />

            {/* Shared routes */}
            <Route path="/messages" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
            <Route path="/chat/:conversationId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
