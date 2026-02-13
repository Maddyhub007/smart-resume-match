import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Loader2, ArrowLeft } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ChatList = () => {
  const { user, role } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  const fetchConversations = async () => {
    setLoading(true);
    const col = role === "recruiter" ? "recruiter_id" : "candidate_id";
    const { data } = await supabase
      .from("conversations")
      .select("*, jobs(title, company)")
      .eq(col, user!.id)
      .order("last_message_at", { ascending: false });

    if (data && data.length > 0) {
      const enriched = await Promise.all(
        data.map(async (conv) => {
          const otherId = conv.recruiter_id === user!.id ? conv.candidate_id : conv.recruiter_id;
          const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("user_id", otherId).single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, created_at, sender_id")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("is_read", false)
            .neq("sender_id", user!.id);

          return { ...conv, otherUser: prof, unreadCount: count || 0, lastMessage: lastMsg };
        })
      );
      setConversations(enriched);
    } else {
      setConversations([]);
    }
    setLoading(false);
  };

  if (loading) {
    return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link
            to={role === "recruiter" ? "/recruiter" : "/dashboard"}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-primary" />
            Messages
          </h1>
          <p className="text-muted-foreground mb-8">{conversations.length} conversation(s)</p>

          {conversations.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No conversations yet</h3>
              <p className="text-muted-foreground text-sm">
                {role === "recruiter"
                  ? "Start a conversation by clicking 'Message' on an applicant."
                  : "When a recruiter messages you about a job, it will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  to={`/chat/${conv.id}`}
                  className="card-elevated p-5 flex items-center gap-4 hover:border-primary/30 transition-all block"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-lg">
                      {(conv.otherUser?.full_name || "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">{conv.otherUser?.full_name || "User"}</h3>
                      <span className="text-xs text-muted-foreground">
                        {conv.lastMessage
                          ? new Date(conv.lastMessage.created_at).toLocaleDateString()
                          : new Date(conv.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.jobs ? `Re: ${(conv.jobs as any).title} at ${(conv.jobs as any).company}` : "Direct message"}
                    </p>
                    {conv.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.lastMessage.sender_id === user!.id ? "You: " : ""}
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ChatList;
