import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MoreVertical, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const personas = [
  {
    id: 1,
    name: "Jenkins Engineer",
    description: "Expert in CI/CD pipelines, automation, and Jenkins configuration. Specialized in pipeline optimization, plugin management, and distributed builds.",
    skills: ["Jenkins", "CI/CD", "DevOps", "Automation", "Groovy", "Pipeline as Code"],
  },
  {
    id: 2,
    name: "Cloud Architect",
    description: "Specialized in AWS, Azure, and cloud infrastructure design. Expert in scalable architecture, cost optimization, and cloud migration strategies.",
    skills: ["AWS", "Azure", "Cloud", "Infrastructure", "Kubernetes", "Terraform"],
  },
  {
    id: 3,
    name: "Security Analyst",
    description: "Focused on security best practices, threat detection, and compliance. Experienced in vulnerability assessment and security automation.",
    skills: ["Security", "Compliance", "Threat Detection", "SIEM", "Penetration Testing"],
  },
];

const PersonaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const persona = personas.find((p) => p.id === Number(id)) || personas[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Persona Specialization</h1>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-start gap-8 mb-8">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {persona.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{persona.name}</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {persona.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {persona.description}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Capabilities</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Expert guidance and troubleshooting</li>
                  <li>Best practices and recommendations</li>
                  <li>Code examples and implementation help</li>
                  <li>Architecture and design consultation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center">
          <Button
            size="lg"
            className="gap-2"
            onClick={() => navigate("/dashboard")}
          >
            <MessageSquare className="h-5 w-5" />
            Start Conversation
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PersonaDetail;
