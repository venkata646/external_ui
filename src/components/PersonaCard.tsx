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

// shadcn/ui Select
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  endpoint: string;                                       // POST: save
  listEndpoint?: (userId?: string) => string | undefined; // GET: list cred_ids
  getEndpoint?: (userId: string, credId: string) => string; // GET: fetch one
  fields: CredField[];              // fields to render and send
  title?: string;                   // dialog title
  description?: string;             // dialog subtitle
};

// Normalize persona names like "Jira Administrator", "Jenkins Specialist"
const personaKey = (name: string) => name.trim().toLowerCase();

// Map persona -> config (extend as you add more personas)
const CRED_CONFIGS: Record<string, PersonaCredConfig> = {
  // Jenkins
  jenkins: {
    endpoint: "/credentials/jenkins/save",
    listEndpoint: (userId?: string) =>
      userId ? `/credentials/jenkins/list/${userId}` : undefined,
    getEndpoint: (userId: string, credId: string) =>
      `/credentials/jenkins/get/${userId}/${credId}?reveal=false`,
    title: "Enter Jenkins Credentials",
    description: "Set up credentials for Jenkins Engineer",
    fields: [
      { key: "jenkins_url",  label: "Jenkins URL",  placeholder: "https://jenkins.company.com", required: true },
      { key: "username",     label: "Username",     placeholder: "Enter username", required: true },
      { key: "api_token",    label: "API Token",    placeholder: "Enter API token", type: "password", required: true },
      { key: "jenkins_proxy_url",    label: "Agent Proxy",    placeholder: "Enter Agent Proxy URL", required: true },
    ],
  },
  // Jira
  jira: {
    endpoint: "/credentials/jira/save",
    listEndpoint: (userId?: string) =>
      userId ? `/credentials/jira/list/${userId}` : undefined,
    getEndpoint: (userId: string, credId: string) =>
      `/credentials/jira/get/${userId}/${credId}?reveal=false`,
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

// Looks for masked strings like "*****", "***REDACTED***", etc.
function looksMasked(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const v = val.trim();
  if (!v) return false;
  return (
    v === "***REDACTED***" ||
    /^[*•●]{3,}$/.test(v) ||                // ******
    /^<hidden>$/i.test(v) ||
    /^MASKED$/i.test(v)
  );
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

  // State for existing cred IDs
  const [credIds, setCredIds] = useState<string[]>([]);
  const [credIdsLoading, setCredIdsLoading] = useState(false);
  const [credIdsError, setCredIdsError] = useState<string | null>(null);
  const [isNewCredId, setIsNewCredId] = useState(false);

  // State for loading a specific cred's values
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    const onAuthChanged = () => {
      const id = getCurrentUserId() ?? "";
      log("INFO", "AUTH_CHANGED_EVENT_RECEIVED", { userId: id });
      setUserId(id);
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  // Initialize form values when dialog opens + fetch existing cred_ids
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

    // Fetch existing cred IDs for dropdown
    if (open && credConfig && userId) {
      const url =
        typeof credConfig.listEndpoint === "function"
          ? credConfig.listEndpoint(userId)
          : credConfig.listEndpoint;

      if (!url) return;

      (async () => {
        try {
          setCredIdsLoading(true);
          setCredIdsError(null);
          const res = await fetch(`${API_BASE}${url}`, {
            headers: {
              "Content-Type": "application/json",
              ...tokenStorage.getAuthHeader(),
            },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const ids: string[] = Array.isArray(data?.cred_ids) ? data.cred_ids : [];
          setCredIds(ids);
          // If last-used cred_id exists in the list, keep it; else default to "main"
          setIsNewCredId(ids.includes(credId) ? false : (credId && credId !== "main"));
          log("INFO", "CRED_ID_LIST_OK", { count: ids.length });
        } catch (err: any) {
          setCredIdsError(err?.message || "Failed to load credentials");
          log("ERROR", "CRED_ID_LIST_FAIL", { message: err?.message });
        } finally {
          setCredIdsLoading(false);
        }
      })();
    }
  }, [open, credConfig, userId]);

  // Helper: apply fetched fields to form, respecting secret masking
  const applyFetchedFields = (fields: Record<string, any>) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const f of credConfig?.fields ?? []) {
        const incoming = fields?.[f.key];
        if (incoming == null) continue;

        if (f.type === "password") {
          // If masked, keep empty; user must re-enter to update
          next[f.key] = looksMasked(incoming) ? "" : String(incoming);
        } else {
          next[f.key] = String(incoming);
        }
      }
      log("DEBUG", "APPLY_FETCHED_FIELDS", redactSecrets(next, sensitiveKeys));
      return next;
    });
  };

  // Fetch fields for a given cred_id and populate the form
  const fetchAndFillCred = async (cid: string) => {
    if (!credConfig?.getEndpoint || !userId || !cid) return;
    try {
      setLoadingFields(true);
      const url = `${API_BASE}${credConfig.getEndpoint(userId, cid)}`;
      log("INFO", "FETCH_CRED_BEGIN", { url, cid });
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...tokenStorage.getAuthHeader(),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.status === "success" && data?.fields) {
        applyFetchedFields(data.fields as Record<string, any>);
      } else {
        log("WARN", "FETCH_CRED_NOT_FOUND", { cid, data });
        // If nothing is found, clear fields
        setForm({});
      }
    } catch (err: any) {
      log("ERROR", "FETCH_CRED_FAIL", { message: err?.message });
    } finally {
      setLoadingFields(false);
    }
  };

  // When dialog opens and a valid credId is selected (existing), load it
  useEffect(() => {
    if (open && credConfig && userId && credId && !isNewCredId) {
      fetchAndFillCred(credId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, credConfig, userId]);

  const onChange = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
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

    // Ensure new cred id is provided if selected
    if (isNewCredId && !credId) {
      toast({
        title: "Credential ID required",
        description: "Please enter a new credential ID (e.g., main, prod, staging).",
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
            }}
          >
            <DialogHeader>
              <DialogTitle>{credConfig?.title ?? "Enter Credentials"}</DialogTitle>
              <DialogDescription>
                {credConfig?.description ?? `Set up credentials for ${persona.name}`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              {/* --- Credential ID selector (dropdown + new) --- */}
              <div className="space-y-2">
                <Label htmlFor="cred_id">Select Credential</Label>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={isNewCredId ? "__new__" : credId}
                      onValueChange={async (val) => {
                        if (val === "__new__") {
                          setIsNewCredId(true);
                          // when creating a new cred, don't keep old values around
                          setForm({});
                          return;
                        }
                        setIsNewCredId(false);
                        setCredId(val);
                        localStorage.setItem("cred_id", val);
                        // fetch and hydrate fields for this cred
                        await fetchAndFillCred(val);
                      }}
                      disabled={credIdsLoading || !!credIdsError}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={credIdsLoading ? "Loading..." : "Choose credential"} />
                      </SelectTrigger>
                      <SelectContent>
                        {credIds.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                        {credIds.length > 0 && (
                          <div className="px-2 py-1 text-xs text-muted-foreground select-none">—</div>
                        )}
                        <SelectItem value="__new__">➕ New credential…</SelectItem>
                      </SelectContent>
                    </Select>
                    {credIdsError && (
                      <p className="text-xs text-destructive mt-1">Failed to load: {credIdsError}</p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => {
                      // quick refresh by toggling dialog
                      setOpen(false);
                      setTimeout(() => setOpen(true), 0);
                    }}
                  >
                    Refresh
                  </Button>
                </div>

                {isNewCredId && (
                  <div className="space-y-2">
                    <Label htmlFor="cred_id_input">New Credential ID</Label>
                    <Input
                      id="cred_id_input"
                      placeholder="e.g., main, prod, staging"
                      value={credId}
                      onChange={(e) => setCredId(e.target.value.trim())}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pick a short, memorable ID. This ID will be used to read/write these credentials later.
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic fields per persona */}
              {credConfig?.fields.map((f) => (
                <div className="space-y-2" key={f.key}>
                  <Label htmlFor={f.key}>
                    {f.label}
                    {loadingFields && (
                      <span className="ml-2 text-[10px] text-muted-foreground align-middle">
                        loading…
                      </span>
                    )}
                  </Label>
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
                <Button type="submit" disabled={loadingFields}>Use Credentials</Button>
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
