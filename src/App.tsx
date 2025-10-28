import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PersonaDetail from "./pages/PersonaDetail";
import Settings from "./pages/Settings";
import PersonaSettings from "./pages/PersonaSettings";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import AdminConsole from "./pages/AdminConsole";
import UpgradePlan from "./pages/UpgradePlan";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/persona/:id" element={<PersonaDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/persona-settings" element={<PersonaSettings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminConsole />} />
          <Route path="/upgrade" element={<UpgradePlan />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
