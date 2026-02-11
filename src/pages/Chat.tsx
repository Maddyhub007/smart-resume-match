import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, Calendar, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const Chat = () => {
  const { conversationId } = useParams();
  const { user, role } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: "", time: "", notes: "" });

  useEffect(() => {
    if (conversationId) fetchData();
  }, [conversationId]);

  useEffect(() => {
    // Real-time subscription
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchData = async () => {
    setLoading(true);
    const [convRes, msgsRes] = await Promise.all([
      supabase.from("conversations").select("*, jobs(title, company)").eq("id", conversationId!).single(),
      supabase.from("messages").select("*").eq("conversation_id", conversationId!).order("created_at", { ascending: true }),
    ]);

    setConversation(convRes.data);
    setMessages(msgsRes.data || []);

    // Get the other user's profile
    if (convRes.data) {
      const otherId = convRes.data.recruiter_id === user!.id ? convRes.data.candidate_id : convRes.data.recruiter_id;
      const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("user_id", otherId).single();
      setOtherUser(prof);
    }

    // Mark messages as read
    if (msgsRes.data) {
      const unread = msgsRes.data.filter((m: any) => !m.is_read && m.sender_id !== user!.id);
      if (unread.length > 0) {
        await supabase.from("messages").update({ is_read: true }).in("id", unread.map((m: any) => m.id));
      }
    }

    setLoading(false);
  };

  const sendMessage = async (content: string, type: string = "text", metadata: any = {}) => {
    if (!content.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      content,
      message_type: type,
      metadata,
    });

    if (error) {
      toast({ title: "Error sending message", variant: "destructive" });
    } else {
      // Update last_message_at
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId!);
    }
    setInput("");
    setSending(false);
  };

  const handleScheduleInterview = () => {
    if (!scheduleForm.date || !scheduleForm.time) {
      toast({ title: "Please select date and time", variant: "destructive" });
      return;
    }
    const content = `📅 Interview Scheduled\nDate: ${scheduleForm.date}\nTime: ${scheduleForm.time}${scheduleForm.notes ? `\nNotes: ${scheduleForm.notes}` : ""}`;
    sendMessage(content, "interview_invite", scheduleForm);
    setShowScheduler(false);
    setScheduleForm({ date: "", time: "", notes: "" });
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="py-4 px-4 h-[calc(100vh-130px)] flex flex-col">
        <div className="container mx-auto max-w-4xl flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
            <Link to={role === "recruiter" ? "/recruiter" : "/profile"} className="p-2 rounded-lg hover:bg-muted">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Link>
            <div className="flex-1">
              <h2 className="font-semibold text-foreground">{otherUser?.full_name || "User"}</h2>
              <p className="text-sm text-muted-foreground">
                {conversation?.jobs ? `Re: ${(conversation.jobs as any).title} at ${(conversation.jobs as any).company}` : "Direct message"}
              </p>
            </div>
            {role === "recruiter" && (
              <button onClick={() => setShowScheduler(!showScheduler)} className="btn-secondary text-sm py-2 px-3">
                <Calendar className="w-4 h-4" /> Schedule Interview
              </button>
            )}
          </div>

          {/* Schedule form */}
          {showScheduler && (
            <div className="card-elevated p-4 mb-4 space-y-3">
              <h4 className="font-semibold text-foreground text-sm">Schedule Interview</h4>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })} className="input-field text-sm" />
                <input type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })} className="input-field text-sm" />
              </div>
              <input value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} placeholder="Additional notes..." className="input-field text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setShowScheduler(false)} className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
                <button onClick={handleScheduleInterview} className="btn-primary text-sm py-1.5 px-3">Send Invite</button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {messages.map((msg) => {
              const isMine = msg.sender_id === user!.id;
              const isInterview = msg.message_type === "interview_invite";

              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    isInterview ? "bg-accent/10 border border-accent/20" :
                    isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {isInterview && <Calendar className="w-4 h-4 text-accent mb-1" />}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${isMine && !isInterview ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
              placeholder="Type a message..."
              className="input-field flex-1"
            />
            <button onClick={() => sendMessage(input)} disabled={sending || !input.trim()} className="btn-primary py-3 px-4">
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Chat;
