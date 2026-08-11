import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell.tsx";
import { CourseDetailPage } from "./pages/CourseDetailPage.tsx";
import { FeaturePage } from "./pages/FeaturePage.tsx";
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
        <Route path="/learn/:slug" element={<LearnPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/swap" element={<FeaturePage type="swap" />} />
        <Route path="/creator" element={<FeaturePage type="creator" />} />
        <Route path="/admin" element={<FeaturePage type="admin" />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </AppShell>
  );
}
