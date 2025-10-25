import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Persona {
  id: number;
  name: string;
  description: string;
  skills: string[];
}

interface ChatInterfaceProps {
  selectedPersona: Persona;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const ChatInterface = ({ selectedPersona }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
    };

    const assistantMessage: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: `As a ${selectedPersona.name}, I can help you with ${selectedPersona.skills.join(", ")}. How can I assist you today?`,
    };

    setMessages([...messages, userMessage, assistantMessage]);
    setInput("");
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
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                <p className="text-sm">{message.content}</p>
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
          />
          <Button onClick={handleSend} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
