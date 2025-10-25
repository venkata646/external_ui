// external_ui/src/components/ChatInterface.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

// Backend base URL (e.g. http://localhost:8000 or your deployed URL)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// Map persona -> endpoint path
const personaEndpointMap: Record<string, string> = {
  // match by persona name (case-insensitive); add more as you add personas
  "jenkins specialist": "/chat/jenkins",
  "jenkins": "/chat/jenkins",
  // "jira specialist": "/chat/jira",
  // "kubernetes sre": "/chat/kubernetes",
};

// Pull an auth token (adjust key to your app’s storage conventions)
function getAuthToken(): string | null {
  // ex: localStorage.setItem("auth_token", "Bearer eyJhbGciOi...")
  const raw = localStorage.getItem("auth_token");
  return raw ?? null;
}

// Optional: read Jenkins creds from localStorage or elsewhere (keeps UI unchanged)
function getJenkinsCreds() {
  return {
    cred_id: localStorage.getItem("cred_id") || "main",
    user_id: localStorage.getItem("user_id") || "tool20",
    jenkins_url: localStorage.getItem("jenkins_url") || "",
    username: localStorage.getItem("jenkins_username") || "",
    api_token: localStorage.getItem("jenkins_api_token") || "",
    jenkins_proxy_url: localStorage.getItem("jenkins_proxy_url") || "",
  };
}

// Build backend payloads per persona. You can extend this switch for others.
function buildPayload(
  persona: Persona,
  chatMessages: Message[]
): Record<string, any> {
  const personality = "practical";
  const mentality = "problem-solving";

  // Convert UI messages to backend-expected minimal shape
  const messages = chatMessages.map(m => ({
    type: m.type,
    content: m.content,
  }));

  const lowerName = persona.name.toLowerCase();

  if (lowerName.includes("jenkins")) {
    const creds = getJenkinsCreds();
    return {
      messages,
      cred_id: creds.cred_id,
      user_id: creds.user_id,
      mentality,
      personality,
      persona_name: persona.name,
      persona_title: persona.name,
      jenkins_url: creds.jenkins_url,
      username: creds.username,
      api_token: creds.api_token,
      jenkins_proxy_url: creds.jenkins_proxy_url,
    };
  }

  // Default payload (mirrors common fields; add service-specific fields as needed)
  return {
    messages,
    cred_id: "main",
    user_id: "user-1",
    mentality,
    personality,
    persona_name: persona.name,
    persona_title: persona.name,
  };
}

// Extract assistant text from a variety of possible backend shapes safely
function extractAssistantText(respJson: any): string {
  // Common patterns:
  // 1) { content: "..." }
  if (respJson?.content && typeof respJson.content === "string") {
    return respJson.content;
  }
  // 2) { answer: "..." }
  if (respJson?.answer && typeof respJson.answer === "string") {
    return respJson.answer;
  }
  // 3) { messages: [{type:'assistant', content:'...'}, ...] }
  const msgs: BackendMessage[] = Array.isArray(respJson?.messages)
    ? respJson.messages
    : [];
  const lastAssistant = [...msgs].reverse().find(m => (m.type ?? "").toLowerCase() === "assistant");
  if (lastAssistant?.content) return lastAssistant.content;

  // Fallback: stringify a small part of response
  return typeof respJson === "string"
    ? respJson
    : JSON.stringify(respJson ?? { message: "No response" }).slice(0, 1200);
}

// -----------------------------------------------------------------------------

const ChatInterface = ({ selectedPersona }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const resolveEndpoint = (persona: Persona): string => {
    const key = persona.name.toLowerCase();
    const path =
      personaEndpointMap[key] ||
      // fuzzy keys by contains
      Object.entries(personaEndpointMap).find(([k]) => key.includes(k))?.[1] ||
      "/chat/jenkins"; // sane default
    return `${API_BASE}${path}`;
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now(),
      type: "human",
      content: input,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const endpoint = resolveEndpoint(selectedPersona);
      const payload = buildPayload(selectedPersona, nextMessages);
      const token = getAuthToken();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}), // if token already includes "Bearer ", keep as-is
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      const assistantText = extractAssistantText(data);

      const assistantMessage: Message = {
        id: Date.now() + 1,
        type: "assistant",
        content: assistantText || "I couldn’t parse a reply from the server.",
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const assistantMessage: Message = {
        id: Date.now() + 1,
        type: "assistant",
        content:
          "Request failed. Please check your API base URL, credentials, and network, then try again.",
      };
      setMessages(prev => [...prev, assistantMessage]);
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
