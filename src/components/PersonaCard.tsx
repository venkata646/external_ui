// external_ui/src/components/PersonaCard.tsx
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Persona {
  id: number;
  name: string;
  description: string;
  skills: string[];
  isOnline?: boolean;
}

interface PersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onClick: () => void;
}

/* ---------------------- Config for persona-specific creds ------------------- */

type FieldType = "text" | "password";

type CredField = {
  key: string;          // payload key
  label: string;        // UI label
  type?: FieldType;     // input type
  placeholder?: string; // UI placeholder
  required?: boolean;
};

type PersonaCredConfig = {
  endpoint: string;     // path appended to API_BASE
  fields: CredField[];  // which fields to render and send
  title?: string;       // optional dialog title override
  description?: string; // optional dialog subtitle override
};

// Normalize persona names like "Jira Administrator", "Jenkins Specialist"
const personaKey = (name: string) => name.trim().toLowerCase();

// Map persona -> config (extend as you add more personas)
const CRED_CONFIGS: Record<string, PersonaCredConfig> = {
  // Jenkins
  "jenkins": {
    endpoint: "/credentials/jenkins/save",
    title: "Enter Jenkins Credentials",
    description: "Set up credentials for Jenkins Engineer",
    fields: [
      { key: "jenkins_url",  label: "Jenkins URL",  placeholder: "https://jenkins.company.com", required: true },
      { key: "username",     label: "Username",     placeholder: "Enter username", required: true },
      { key: "api_token",    label: "API Token",    placeholder: "Enter API token", type: "password", required: true },
    ],
  },
  // Jira
  "jira": {
    endpoint: "/credentials/jira/save",
    title: "Enter Jira Credentials",
    description: "Set up credentials for Jira Administrator",
    fields: [
      { key: "jira_url",       label: "Jira URL",       placeholder: "https://your-domain.atlassian.net", required: true },
      { key: "jira_email",     label: "Jira Email",     placeholder: "name@company.com", required: true },
      { key: "jira_api_token", label: "Jira API Token", placeholder: "Enter API token", type: "password", required: true },
    ],
  },
};

// Resolve config by fuzzy matching words present in persona.name
function getConfigForPersona(name: string): PersonaCredConfig | null {
  const key = personaKey(name);
  if (CRED_CONFIGS[key]) return CRED_CONFIGS[key];
  if (key.includes("jenkins")) return CRED_CONFIGS["jenkins"];
  if (key.includes("jira")) return CRED_CONFIGS["jira"];
  return null;
}

/* ----------------------------- Helpers ------------------------------------- */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function getAuthToken(): string | null {
  // Store as "Bearer <jwt>" or whatever your API expects
  return localStorage.getItem("auth_token");
}

// Defaults / previously saved values (optional)
function getSeedValues(keys: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const k of keys) {
    obj[k] = localStorage.getItem(k) ?? "";
  }
  return obj;
}

function saveSeedValues(values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) {
    try { localStorage.setItem(k, v); } catch {}
  }
}

/* ----------------------------- Component ----------------------------------- */

const PersonaCard = ({ persona, isSelected, onClick }: PersonaCardProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Persona-specific config
  const credConfig = useMemo(() => getConfigForPersona(persona.name), [persona.name]);

  // Generic form state keyed by field.key
  const [form, setForm] = useState<Record<string, string>>({});

  // Common metadata (not shown as inputs)
  const [userId, setUserId] = useState<string>(localStorage.getItem("user_id") || "tool20");
  const [credId, setCredId] = useState<string>(localStorage.getItem("cred_id") || "main");

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open && credConfig) {
      const keys = credConfig.fields.map(f => f.key);
      const seed = getSeedValues(keys);
      setForm(seed);
    }
  }, [open, credConfig]);

  const onChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!credConfig) {
      toast({ title: "Unsupported Persona", description: "No credential form configured for this persona.", variant: "destructive" });
      return;
    }

    // Front-end required validation
    const missing = credConfig.fields.filter(f => f.required && !form[f.key]);
    if (missing.length) {
      toast({
        title: "Missing Fields",
        description: `Please fill: ${missing.map(m => m.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Build payload per backend schema + add user_id & cred_id
    const payload: Record<string, any> = {
      user_id: userId || "tool20",
      cred_id: credId || "main",
      ...form,
    };

    try {
      const res = await fetch(`${API_BASE}${credConfig.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthToken() ? { Authorization: getAuthToken() as string } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      // Persist for convenience (optional)
      saveSeedValues(form);
      localStorage.setItem("user_id", payload.user_id);
      localStorage.setItem("cred_id", payload.cred_id);

      toast({
        title: "Credentials Saved",
        description: `Credentials for ${persona.name} saved successfully.`,
      });

      setOpen(false);
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "Unable to save credentials.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary bg-accent/50"
      )}
      onClick={onClick}
    >
      <div className="flex gap-3 mb-3">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
            {persona.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-2">{persona.name}</h3>
          <div className="flex flex-wrap gap-1">
            {persona.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs px-2 py-0">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-border rounded p-2 bg-background/50 mb-3">
        <p className="text-xs text-muted-foreground line-clamp-3">
          {persona.description}
        </p>
      </div>

      {/* Bottom buttons and status */}
      <div className="flex items-center justify-between">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Key className="h-3 w-3" />
              Credentials
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>{credConfig?.title ?? "Enter Credentials"}</DialogTitle>
              <DialogDescription>
                {credConfig?.description ?? `Set up credentials for ${persona.name}`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              {/* Optional: show/edit user_id & cred_id (hidden by default). 
                  If you'd like to expose them, uncomment the block below. */}
              {/* <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="user_id">User ID</Label>
                  <Input id="user_id" value={userId} onChange={(e) => setUserId(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cred_id">Credential ID</Label>
                  <Input id="cred_id" value={credId} onChange={(e) => setCredId(e.target.value)} />
                </div>
              </div> */}

              {/* Dynamic fields per persona */}
              {credConfig?.fields.map((f) => (
                <div className="space-y-2" key={f.key}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type === "password" ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ""}
                    onChange={(e) => onChange(f.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Credentials</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-1.5">
          <Circle
            className={cn(
              "h-2 w-2 fill-current",
              persona.isOnline ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              persona.isOnline ? "text-primary" : "text-muted-foreground"
            )}
          >
            {persona.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default PersonaCard;
