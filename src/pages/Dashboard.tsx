import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, User, Search, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PersonaCard from "@/components/PersonaCard";
import ChatInterface from "@/components/ChatInterface";

const personas = [
  {
    id: 1,
    name: "Jenkins Engineer",
    description: "Expert in CI/CD pipelines, automation, and Jenkins configuration",
    skills: ["Jenkins", "CI/CD", "DevOps", "Automation"],
    isOnline: true,
  },
  {
    id: 2,
    name: "Jira Administrator",
    description: "Specialized in AWS, Azure, and cloud infrastructure design",
    skills: ["AWS", "Azure", "Cloud", "Infrastructure"],
    isOnline: false,
  },
  {
    id: 3,
    name: "Grafana Specialist",
    description: "Focused on security best practices, threat detection, and compliance",
    skills: ["Security", "Compliance", "Threat Detection"],
    isOnline: true,
  },
];

const Dashboard = () => {
  const [selectedPersona, setSelectedPersona] = useState(personas[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredPersonas = personas.filter(persona =>
    persona.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Persona Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Persona Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isSelected={selectedPersona.id === persona.id}
              onClick={() => setSelectedPersona(persona)}
            />
          ))}
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">Persona Chat</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
          >
            <User className="h-5 w-5" />
          </Button>
        </div>

        {/* Chat Interface */}
        <ChatInterface selectedPersona={selectedPersona} />
      </div>
    </div>
  );
};

export default Dashboard;
