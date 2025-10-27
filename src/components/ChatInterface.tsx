// external_ui/src/components/ChatInterface.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { tokenStorage } from "@/lib/auth";


interface Persona {
  id: number;
  name: string;          // e.g., "Jenkins Specialist"
  description: string;
  skills: string[];
}

interface ChatInterfaceProps {
  selectedPersona: Persona;
}

interface Message {
  id: number;
  type: "human" | "assistant";
  content: string;
}

type BackendMessage = { type?: string; content?: string };

// --- CONFIG ------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function getAuthToken(): string | null {
  const raw = localStorage.getItem("auth_token");
  return raw ?? null;
}

function getUserIdentity() {
  return {
    user_id: localStorage.getItem("user_id") || "test_user",
    cred_id: localStorage.getItem("cred_id") || "main",
  };
}


function getJenkinsCreds() {
  return {
    cred_id: localStorage.getItem("cred_id") || "",
    user_id: localStorage.getItem("user_id") || "",
    jenkins_url: localStorage.getItem("jenkins_url") || "",
    username: localStorage.getItem("jenkins_username") || "",
    api_token: localStorage.getItem("jenkins_api_token") || "",
    jenkins_proxy_url: localStorage.getItem("jenkins_proxy_url") || "",
  };
}

function getJiraCreds() {
  return {
    cred_id: localStorage.getItem("cred_id") || "",
    user_id: localStorage.getItem("user_id") || "",
    jira_url: localStorage.getItem("jira_url") || "",
    jira_email: localStorage.getItem("jira_email") || "",
    jira_api_token: localStorage.getItem("jira_api_token") || "",
    jira_proxy_url: localStorage.getItem("jira_proxy_url") || "",
  };
}

// Build payload using ONLY the latest user message
function buildPayload(
  persona: Persona,
  latestUserMessage: Message,
  threadId?: string | null
): Record<string, any> {
  const personality = "practical";
  const mentality = "problem-solving";

  // only one message (the one just typed)
  const messages = [{ type: "human", content: latestUserMessage.content }];
  const lowerName = persona.name.toLowerCase();
  const { user_id, cred_id } = getUserIdentity();
  const base = {
    messages,
    cred_id,
    user_id,
    mentality,
    personality,
    persona_name: persona.name,
    persona_title: persona.name,
    ...(threadId ? { thread_id: threadId } : {}),
  };

  if (lowerName.includes("jenkins")) {
    const creds = getJenkinsCreds();
    return {
      ...base,
      jenkins_url: creds.jenkins_url,
      username: creds.username,
      api_token: creds.api_token,
      jenkins_proxy_url: creds.jenkins_proxy_url,
    };
  }

  if (lowerName.includes("jira")) {
    const creds = getJiraCreds();
    return {
      ...base,
      jira_url: creds.jira_url,
      jira_email: creds.jira_email,
      jira_api_token: creds.jira_api_token,
      jira_proxy_url: creds.jira_proxy_url,
    };
  }

  return base;
}

// Extract assistant text safely (adds support for { reply: "..." })
function extractAssistantText(respJson: any): string {
  if (respJson?.reply && typeof respJson.reply === "string") return respJson.reply;
  if (respJson?.content && typeof respJson.content === "string") return respJson.content;
  if (respJson?.answer && typeof respJson.answer === "string") return respJson.answer;

  const msgs: BackendMessage[] = Array.isArray(respJson?.messages)
    ? respJson.messages
    : [];
  const lastAssistant = [...msgs].reverse().find(m => (m.type ?? "").toLowerCase() === "assistant");
  if (lastAssistant?.content) return lastAssistant.content;

  return typeof respJson === "string"
    ? respJson
    : JSON.stringify(respJson ?? { message: "No response" }).slice(0, 1200);
}

// -----------------------------------------------------------------------------

const ChatInterface = ({ selectedPersona }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null); // optional thread continuity
  const navigate = useNavigate();

  // Reset chat when the selected persona changes
  useEffect(() => {
    setMessages([]);
    setThreadId(null);
    setInput("");
  // you could also cancel in-flight requests here, if any
  }, [selectedPersona.id]);

  const resolveEndpoint = (persona: Persona): string => {
    const key = persona.name.toLowerCase();
    if (key.includes("jenkins")) return `${API_BASE}/chat/jenkins`;
    if (key.includes("jira")) return `${API_BASE}/chat/jira`;
    if (key.includes("grafana")) return `${API_BASE}/chat/grafana`; // if you add this backend
    return `${API_BASE}/chat/jenkins`; // default
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    // 1) Push the user message to the UI
    const userMessage: Message = {
      id: Date.now(),
      type: "human",
      content: input,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      // 2) Send ONLY the new user message to backend
      const endpoint = resolveEndpoint(selectedPersona);
      const payload = buildPayload(selectedPersona, userMessage, threadId);
      const token = getAuthToken();

      // const res = await fetch(endpoint, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     ...(token ? { Authorization: token } : {}),
      //   },
      //   body: JSON.stringify(payload),
      // });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tokenStorage.getAuthHeader(), // adds Bearer correctly
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      // optional: remember thread_id if backend returns it
      if (data?.thread_id && typeof data.thread_id === "string") {
        setThreadId(data.thread_id);
      }

      const assistantText = extractAssistantText(data);
      const assistantMessage: Message = {
        id: Date.now() + 1,
        type: "assistant",
        content: assistantText || "I couldn’t parse a reply from the server.",
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          type: "assistant",
          content:
            "Request failed. Please check your API base URL, credentials, and network, then try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Persona Info Banner */}
      <div className="bg-accent/30 border-b border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {selectedPersona.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{selectedPersona.name}</h3>
            <p className="text-xs text-muted-foreground">
              {selectedPersona.skills.join(" • ")}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/persona/${selectedPersona.id}`)}
        >
          <Info className="h-4 w-4 mr-1" />
          View Details
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">
                Start a conversation with {selectedPersona.name}
              </h2>
              <p className="text-muted-foreground text-sm">
                {selectedPersona.description}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "human" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.type === "human"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            disabled={sending}
          />
          <Button onClick={handleSend} size="icon" disabled={sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
