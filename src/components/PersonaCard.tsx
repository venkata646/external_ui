import { useState } from "react";
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

const PersonaCard = ({ persona, isSelected, onClick }: PersonaCardProps) => {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    // Here you would typically save credentials securely
    toast({
      title: "Credentials Saved",
      description: `Credentials for ${persona.name} have been saved successfully`,
    });
    
    setOpen(false);
    setCredentials({ username: "", password: "" });
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
            {persona.name.split(' ').map(word => word[0]).join('').slice(0, 2)}
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1 h-7 text-xs"
            >
              <Key className="h-3 w-3" />
              Credentials
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Enter Credentials</DialogTitle>
              <DialogDescription>
                Set up credentials for {persona.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Credentials
                </Button>
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
          <span className={cn(
            "text-xs font-medium",
            persona.isOnline ? "text-primary" : "text-muted-foreground"
          )}>
            {persona.isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default PersonaCard;
