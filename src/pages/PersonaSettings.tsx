import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Key, Loader2, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

type PersonaType = "jenkins" | "jira" | "grafana";

type JenkinsCredentialForm = {
  cred_id: string;
  jenkins_url: string;
  username: string;
  api_token: string;
};

type JiraCredentialForm = {
  cred_id: string;
  jira_url: string;
  jira_email: string;
  jira_api_token: string;
};

type CredDetailResponse = {
  status: "success" | "not_found" | "error";
  persona?: string;
  user_id?: string;
  cred_id?: string;
  key_used?: "new" | "legacy";
  fields?: Record<string, string>;
  secrets_masked?: boolean;
  message?: string;
};

const PersonaSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Selected persona tab
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>("jenkins");

  // Stable user id (resolved once)
  const [userId, setUserId] = useState<string | null>(null);

  // Lists + loading
  const [credentials, setCredentials] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Forms
  const [jenkinsForm, setJenkinsForm] = useState<JenkinsCredentialForm>({
    cred_id: "",
    jenkins_url: "",
    username: "",
    api_token: "",
  });

  const [jiraForm, setJiraForm] = useState<JiraCredentialForm>({
    cred_id: "",
    jira_url: "",
    jira_email: "",
    jira_api_token: "",
  });

  // Expanded row state
  const [expandedCredId, setExpandedCredId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [credFields, setCredFields] = useState<Record<string, string> | null>(null);
  const [secretsMasked, setSecretsMasked] = useState(true);

  // Resolve user once
  useEffect(() => {
    const u = authService.getCurrentUser();
    if (!u) {
      navigate("/");
      return;
    }
    setUserId(u.id);
  }, [navigate]);

  // Fetch list
  const fetchCredentials = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/credentials/${selectedPersona}/list/${userId}`,
          { signal }
        );
        const data = await res.json();
        setCredentials(Array.isArray(data?.cred_ids) ? data.cred_ids : []);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast({
            title: "Error",
            description: "Failed to fetch credentials",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPersona, userId, toast]
  );

  // Re-fetch on persona switch or manual refresh
  useEffect(() => {
    const controller = new AbortController();
    fetchCredentials(controller.signal);
    // Collapse any open detail when switching persona or refreshing
    setExpandedCredId(null);
    setCredFields(null);
    setSecretsMasked(true);
    return () => controller.abort();
  }, [fetchCredentials, refreshKey]);

  // Load a single credential's details
  const loadCredDetail = useCallback(
    async (credId: string, reveal = false) => {
      if (!userId) return;
      setDetailLoading(true);
      try {
        const qs = reveal ? "?reveal=true" : "?reveal=false";
        const res = await fetch(
          `${API_BASE_URL}/credentials/${selectedPersona}/get/${userId}/${encodeURIComponent(
            credId
          )}${qs}`
        );
        const data: CredDetailResponse = await res.json();
        if (data.status === "success" && data.fields) {
          setCredFields(data.fields);
          setSecretsMasked(!!data.secrets_masked);
        } else if (data.status === "not_found") {
          setCredFields(null);
          toast({
            title: "Not found",
            description: "No credentials found for this ID.",
          });
        } else {
          throw new Error(data.message || "Failed to load details");
        }
      } catch (err: any) {
        toast({
          title: "Error",
          description: err?.message || "Failed to load credential details",
          variant: "destructive",
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedPersona, userId, toast]
  );

  // Toggle expand/collapse + fetch (masked by default)
  const onClickRow = (credId: string) => {
    if (expandedCredId === credId) {
      // collapse
      setExpandedCredId(null);
      setCredFields(null);
      setSecretsMasked(true);
      return;
    }
    setExpandedCredId(credId);
    setCredFields(null);
    setSecretsMasked(true);
    // fetch details masked
    void loadCredDetail(credId, false);
  };

  // Reveal / Hide
  const onToggleReveal = async () => {
    if (!expandedCredId) return;
    const nextReveal = secretsMasked; // if currently masked -> reveal=true; if shown -> reveal=false
    await loadCredDetail(expandedCredId, nextReveal);
  };

  const handleAddCredential = async () => {
    if (!userId) return;

    setIsSaving(true);
    try {
      let endpoint = "";
      let payload: any = {};
      if (selectedPersona === "jenkins") {
        const { cred_id, jenkins_url, username, api_token } = jenkinsForm;
        if (!cred_id || !jenkins_url || !username || !api_token) {
          toast({
            title: "Validation Error",
            description: "All Jenkins fields are required",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        endpoint = `${API_BASE_URL}/credentials/jenkins/save`;
        payload = { user_id: userId, ...jenkinsForm };
      } else if (selectedPersona === "jira") {
        const { cred_id, jira_url, jira_email, jira_api_token } = jiraForm;
        if (!cred_id || !jira_url || !jira_email || !jira_api_token) {
          toast({
            title: "Validation Error",
            description: "All Jira fields are required",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        endpoint = `${API_BASE_URL}/credentials/jira/save`;
        payload = { user_id: userId, ...jiraForm };
      } else {
        toast({
          title: "Unsupported",
          description: "Grafana credentials are not yet supported",
        });
        setIsSaving(false);
        return;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data?.status === "success" || data?.status === "noop") {
        toast({
          title: "Success",
          description: "Credential saved successfully",
        });
        setIsDialogOpen(false);
        setJenkinsForm({ cred_id: "", jenkins_url: "", username: "", api_token: "" });
        setJiraForm({ cred_id: "", jira_url: "", jira_email: "", jira_api_token: "" });

        // Force refresh list; keep detail closed (safer)
        setExpandedCredId(null);
        setCredFields(null);
        setSecretsMasked(true);
        setRefreshKey((k) => k + 1);
      } else {
        throw new Error(data?.message || "Failed to save credential");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save credential",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canSaveJenkins =
    jenkinsForm.cred_id && jenkinsForm.jenkins_url && jenkinsForm.username && jenkinsForm.api_token;

  const canSaveJira =
    jiraForm.cred_id && jiraForm.jira_url && jiraForm.jira_email && jiraForm.jira_api_token;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="w-full justify-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <div className="p-4">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">PERSONAS</h2>
          <div className="space-y-2">
            <Button
              variant={selectedPersona === "jenkins" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedPersona("jenkins")}
            >
              Jenkins Persona Setting
            </Button>
            <Button
              variant={selectedPersona === "jira" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedPersona("jira")}
            >
              Jira Persona Setting
            </Button>
            <Button
              variant={selectedPersona === "grafana" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedPersona("grafana")}
            >
              Grafana Persona Setting
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="px-6 py-4">
            <h1 className="text-lg font-semibold">Persona Settings Page</h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    {selectedPersona === "jenkins" && "Jenkins Persona Setting"}
                    {selectedPersona === "jira" && "Jira Persona Setting"}
                    {selectedPersona === "grafana" && "Grafana Persona Setting"}
                    <span className="text-sm text-muted-foreground ml-2">
                      {credentials.length} saved
                    </span>
                  </CardTitle>
                  <CardDescription>Manage credentials for this persona</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    disabled={isLoading}
                    title="Refresh"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Refresh
                  </Button>

                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Credential
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Credential</DialogTitle>
                        <DialogDescription>
                          Add a new credential for {selectedPersona}
                        </DialogDescription>
                      </DialogHeader>

                      {/* Jenkins form */}
                      {selectedPersona === "jenkins" && (
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="cred_id">Credential ID</Label>
                            <Input
                              id="cred_id"
                              placeholder="e.g., prod-jenkins"
                              value={jenkinsForm.cred_id}
                              onChange={(e) =>
                                setJenkinsForm((p) => ({ ...p, cred_id: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="jenkins_url">Jenkins URL</Label>
                            <Input
                              id="jenkins_url"
                              placeholder="https://jenkins.example.com"
                              value={jenkinsForm.jenkins_url}
                              onChange={(e) =>
                                setJenkinsForm((p) => ({ ...p, jenkins_url: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              placeholder="admin"
                              value={jenkinsForm.username}
                              onChange={(e) =>
                                setJenkinsForm((p) => ({ ...p, username: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="api_token">API Token</Label>
                            <Input
                              id="api_token"
                              type="password"
                              placeholder="Enter API token"
                              value={jenkinsForm.api_token}
                              onChange={(e) =>
                                setJenkinsForm((p) => ({ ...p, api_token: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Jira form */}
                      {selectedPersona === "jira" && (
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="cred_id">Credential ID</Label>
                            <Input
                              id="cred_id"
                              placeholder="e.g., prod-jira"
                              value={jiraForm.cred_id}
                              onChange={(e) =>
                                setJiraForm((p) => ({ ...p, cred_id: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="jira_url">Jira URL</Label>
                            <Input
                              id="jira_url"
                              placeholder="https://company.atlassian.net"
                              value={jiraForm.jira_url}
                              onChange={(e) =>
                                setJiraForm((p) => ({ ...p, jira_url: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="jira_email">Email</Label>
                            <Input
                              id="jira_email"
                              type="email"
                              placeholder="user@example.com"
                              value={jiraForm.jira_email}
                              onChange={(e) =>
                                setJiraForm((p) => ({ ...p, jira_email: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="jira_api_token">API Token</Label>
                            <Input
                              id="jira_api_token"
                              type="password"
                              placeholder="Enter API token"
                              value={jiraForm.jira_api_token}
                              onChange={(e) =>
                                setJiraForm((p) => ({ ...p, jira_api_token: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      {selectedPersona === "grafana" && (
                        <div className="py-6 text-sm text-muted-foreground">
                          Grafana credentials are not yet supported.
                        </div>
                      )}

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddCredential}
                          disabled={
                            isSaving ||
                            selectedPersona === "grafana" ||
                            (selectedPersona === "jenkins" && !canSaveJenkins) ||
                            (selectedPersona === "jira" && !canSaveJira)
                          }
                        >
                          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Add Credential
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {credentials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No credentials added yet. Click &quot;Add Credential&quot; to get started.
                    </p>
                  ) : (
                    credentials.map((credId) => {
                      const isExpanded = expandedCredId === credId;
                      return (
                        <div
                          key={credId}
                          className="border border-border rounded-lg bg-card"
                        >
                          {/* Row header */}
                          <button
                            onClick={() => onClickRow(credId)}
                            className="w-full text-left p-4 flex items-center justify-between hover:bg-accent/40 rounded-t-lg"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">{credId}</p>
                              <p className="text-sm text-muted-foreground">{selectedPersona} credential</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <span className="text-xs text-muted-foreground">Collapse</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">View</span>
                              )}
                            </div>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="px-4 pb-4">
                              <div className="border-t border-border my-2" />
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm text-muted-foreground">
                                  {detailLoading ? "Loading details…" : secretsMasked ? "Secrets are masked" : "Secrets are visible"}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={onToggleReveal}
                                  disabled={detailLoading}
                                >
                                  {detailLoading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : secretsMasked ? (
                                    <Eye className="h-4 w-4 mr-2" />
                                  ) : (
                                    <EyeOff className="h-4 w-4 mr-2" />
                                  )}
                                  {secretsMasked ? "Reveal secrets" : "Hide secrets"}
                                </Button>
                              </div>

                              {detailLoading ? (
                                <div className="py-6 flex items-center justify-center">
                                  <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                              ) : credFields ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {Object.entries(credFields).map(([k, v]) => (
                                    <div
                                      key={k}
                                      className="rounded-md border border-border p-3 bg-background/40"
                                    >
                                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                        {k}
                                      </div>
                                      <div className="text-sm break-all">{v || <span className="text-muted-foreground">—</span>}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground py-4">
                                  No data to display.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonaSettings;
