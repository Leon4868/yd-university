import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell.tsx";
import { AccessBoundary } from "./auth/AccessBoundary.tsx";
import { allRoles, creatorCenterRoles, learnerRoles } from "./auth/permissions.ts";
import { AdminPage } from "./pages/AdminPage.tsx";
import { CourseDetailPage } from "./pages/CourseDetailPage.tsx";
import { CreatorPage } from "./pages/CreatorPage.tsx";
import { SwapPage } from "./pages/SwapPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { LearnPage } from "./pages/LearnPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/courses/:slug" element={<CourseDetailPage />} />
        <Route path="/learn/:slug" element={<AccessBoundary roles={learnerRoles}><LearnPage /></AccessBoundary>} />
        <Route path="/profile" element={<AccessBoundary roles={allRoles}><ProfilePage /></AccessBoundary>} />
        <Route path="/swap" element={<AccessBoundary roles={learnerRoles}><SwapPage /></AccessBoundary>} />
        <Route path="/creator" element={<AccessBoundary roles={creatorCenterRoles}><CreatorPage /></AccessBoundary>} />
        <Route path="/admin" element={<AccessBoundary roles={["admin"]}><AdminPage /></AccessBoundary>} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </AppShell>
  );
}
