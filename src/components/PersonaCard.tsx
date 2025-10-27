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
import { authService, tokenStorage, getCurrentUserId } from "@/lib/auth";

/* -------------------------------- Logging ---------------------------------- */
const LOG_ENABLED = !!import.meta.env.VITE_API_BASE_URL;
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
function log(level: LogLevel, label: string, data?: unknown) {
  if (!LOG_ENABLED) return;
  const time = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level === "ERROR" ? "error" : level === "WARN" ? "warn" : "log"](
    `[${time}] [PERSONA:${label}]`,
    data ?? ""
  );
}

// Redact secrets from any object based on typical secret key names
function redactSecrets<T extends Record<string, any>>(
  obj: T,
  secretKeys: string[] = []
): T {
  const SUSPICIOUS = ["password", "token", "secret", "api_key", "apiToken"];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const lower = k.toLowerCase();
    const flagged =
      secretKeys.includes(k) ||
      SUSPICIOUS.some((s) => lower.includes(s.toLowerCase()));
    out[k] = flagged && typeof v === "string" && v.length > 0 ? "***REDACTED***" : v;
  }
  return out as T;
}

/* ---------------------- Types & Config for persona creds -------------------- */

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
  jenkins: {
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
  jira: {
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

/* -------------------------------- Helpers ---------------------------------- */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function getAuthToken(): string | null {
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
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
}

/* ----------------------------- Component ----------------------------------- */

const PersonaCard = ({ persona, isSelected, onClick }: PersonaCardProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Persona-specific config
  const credConfig = useMemo(() => {
    const cfg = getConfigForPersona(persona.name);
    log("DEBUG", "CONFIG_RESOLVE", { persona: persona.name, hasConfig: !!cfg });
    return cfg;
  }, [persona.name]);

  // Sensitive keys derived from fields marked password + common patterns
  const sensitiveKeys = useMemo(
    () => (credConfig?.fields ?? [])
      .filter((f) => f.type === "password")
      .map((f) => f.key),
    [credConfig]
  );

  // Generic form state keyed by field.key
  const [form, setForm] = useState<Record<string, string>>({});

  // Common metadata (not shown as inputs)
  const initialUserId = getCurrentUserId();
  const [userId, setUserId] = useState<string>(initialUserId ?? "");
  const [credId, setCredId] = useState<string>(localStorage.getItem("cred_id") || "main");

  useEffect(() => {
    const onAuthChanged = () => {
      const id = getCurrentUserId() ?? "";
      log("INFO", "AUTH_CHANGED_EVENT_RECEIVED", { userId: id });
      setUserId(id);
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  // Initialize form values when dialog opens
  useEffect(() => {
    if (open && credConfig) {
      const keys = credConfig.fields.map((f) => f.key);
      const seed = getSeedValues(keys);
      setForm(seed);
      log("INFO", "DIALOG_OPEN", {
        persona: persona.name,
        seed: redactSecrets(seed, sensitiveKeys),
      });
    }
    // ensure userId is synced on first open/mount
    const id = getCurrentUserId();
    if (id && id !== userId) {
      log("DEBUG", "USER_ID_SYNC", { from: userId, to: id });
      setUserId(id);
    }
  }, [open, credConfig]);

  const onChange = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Log each field edit with redaction where necessary
      log("DEBUG", "FORM_CHANGE", redactSecrets({ [key]: value }, sensitiveKeys));
      return next;
    });
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const liveUserId = getCurrentUserId();

    if (!authService.isAuthenticated() || !userId) {
      log("WARN", "SAVE_BLOCKED_NOT_AUTHENTICATED", { userId, liveUserId });
      toast({
        title: "Sign in required",
        description: "Please sign in to save credentials.",
        variant: "destructive",
      });
      return;
    }

    if (!credConfig) {
      log("WARN", "SAVE_BLOCKED_NO_CONFIG", { persona: persona.name });
      toast({
        title: "Unsupported Persona",
        description: "No credential form configured for this persona.",
        variant: "destructive",
      });
      return;
    }

    // Front-end required validation
    const missing = credConfig.fields.filter((f) => f.required && !form[f.key]);
    if (missing.length) {
      const missingLabels = missing.map((m) => m.label).join(", ");
      log("WARN", "VALIDATION_MISSING_FIELDS", { missing: missingLabels });
      toast({
        title: "Missing Fields",
        description: `Please fill: ${missingLabels}`,
        variant: "destructive",
      });
      return;
    }

    // Build payload per backend schema + add user_id & cred_id
    const payload: Record<string, any> = {
      user_id: liveUserId,
      cred_id: credId || "main",
      ...form,
    };
    log("INFO", "SAVE_REQUEST", {
      endpoint: `${API_BASE}${credConfig.endpoint}`,
      payload: redactSecrets(payload, sensitiveKeys),
      hasAuthHeader: !!tokenStorage.get(),
    });

    const started = performance.now();
    try {
      const res = await fetch(`${API_BASE}${credConfig.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tokenStorage.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      const ms = Math.round(performance.now() - started);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        log("ERROR", "SAVE_RESPONSE_ERROR", {
          status: res.status,
          duration_ms: ms,
          body: text?.slice(0, 1000),
        });
        throw new Error(text || `HTTP ${res.status}`);
      }

      let respBody: any = null;
      try {
        respBody = await res.json();
      } catch {
        // Not all endpoints return JSON—ignore
      }
      log("INFO", "SAVE_RESPONSE_OK", {
        status: res.status,
        duration_ms: ms,
        body: respBody ?? "<no-json>",
      });

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
      log("ERROR", "SAVE_EXCEPTION", { message: err?.message });
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
      onClick={() => {
        log("DEBUG", "CARD_CLICK", { persona: persona.name, isSelected });
        onClick();
      }}
    >
      <div className="flex gap-3 mb-3">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
            {persona.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
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
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            log("DEBUG", "DIALOG_TOGGLE", { open: v, persona: persona.name });
          }}
        >
          <DialogTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation();
              log("DEBUG", "DIALOG_TRIGGER_CLICK");
            }}
          >
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs">
              <Key className="h-3 w-3" />
              Credentials
            </Button>
          </DialogTrigger>

          <DialogContent
            className="sm:max-w-md"
            onClick={(e) => {
              e.stopPropagation();
              // Prevent card onClick
            }}
          >
            <DialogHeader>
              <DialogTitle>{credConfig?.title ?? "Enter Credentials"}</DialogTitle>
              <DialogDescription>
                {credConfig?.description ?? `Set up credentials for ${persona.name}`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    log("DEBUG", "DIALOG_CANCEL_CLICK");
                    setOpen(false);
                  }}
                >
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
