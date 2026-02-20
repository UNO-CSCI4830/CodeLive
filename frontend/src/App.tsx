import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import LandingPage from "@/pages/landing/LandingPage";
import AuthPage from "@/pages/auth/AuthPage";
import RolePage from "@/pages/role/RolePage";
import DashboardPage from "@/pages/dashboard/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/role" element={<RolePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
