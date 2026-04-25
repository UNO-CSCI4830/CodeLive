import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import LandingPage from "@/pages/landing/LandingPage";
import AuthPage from "@/pages/auth/AuthPage";
import RolePage from "@/pages/role/RolePage";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import AccountPage from "@/pages/account/AccountPage";
import QuestionCataloguePage from "@/pages/question-catalogue/QuestionCataloguePage";
import CategoryDetailPage from "@/pages/question-catalogue/CategoryDetailPage";
import NotFoundPage from "@/pages/NotFoundPage";

/* Lazy-load the heavy editor pages so Monaco doesn't bloat the initial bundle. */
const FrontendPreviewPage = lazy(
  () => import("@/pages/question-catalogue/frontendpreview/FrontendPreviewPage"),
);
const LeetcodePreviewPage = lazy(
  () => import("@/pages/question-catalogue/leetcodepreview/LeetcodePreviewPage"),
);
const BackendPreviewPage = lazy(
  () => import("@/pages/question-catalogue/backendpreview/BackendPreviewPage"),
);
const DatabasePreviewPage = lazy(
  () => import("@/pages/question-catalogue/databasepreview/DatabasePreviewPage"),
);

/* Session pages (lazy-loaded — they pull in Yjs + Monaco) */
const CreateSessionPage = lazy(
  () => import("@/pages/session/create/CreateSessionPage"),
);
const SessionLobbyPage = lazy(
  () => import("@/pages/session/lobby/SessionLobbyPage"),
);
const InterviewSessionPage = lazy(
  () => import("@/pages/session/interview/InterviewSessionPage"),
);
const InterviewReportPage = lazy(
  () => import("@/pages/session/report/InterviewReportPage"),
);
const ReportsListPage = lazy(
  () => import("@/pages/reports/ReportsListPage"),
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Loading editor…</div>}>
          <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/role" element={<RolePage />} />

          {/* Authenticated routes (sidebar layout) */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/questions" element={<QuestionCataloguePage />} />
            <Route path="/questions/:categorySlug" element={<CategoryDetailPage />} />
            {/* Create session is within the dashboard layout (sidebar visible) */}
            <Route path="/session/create" element={<CreateSessionPage />} />
            {/* Reports — sidebar visible */}
            <Route path="/reports" element={<ReportsListPage />} />
            <Route path="/session/:sessionId/report" element={<InterviewReportPage />} />
          </Route>

          {/* Full-screen editors — no sidebar */}
          <Route path="/questions/frontend/:problemId" element={<FrontendPreviewPage />} />
          <Route path="/questions/leetcode/:problemId" element={<LeetcodePreviewPage />} />
          <Route path="/questions/backend/:problemId" element={<BackendPreviewPage />} />
          <Route path="/questions/database/:problemId" element={<DatabasePreviewPage />} />

          {/* Session pages — full-screen, no sidebar */}
          <Route path="/session/:sessionId/lobby" element={<SessionLobbyPage />} />
          <Route path="/session/:sessionId" element={<InterviewSessionPage />} />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
