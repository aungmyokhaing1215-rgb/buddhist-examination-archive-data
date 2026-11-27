import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout.jsx';

const HomePage = lazy(() => import('../pages/public/HomePage.jsx'));
const BrowsePage = lazy(() => import('../pages/public/BrowsePage.jsx'));
const ExamPage = lazy(() => import('../pages/public/ExamPage.jsx'));
const SearchPage = lazy(() => import('../pages/public/SearchPage.jsx'));
const AboutPage = lazy(() => import('../pages/public/AboutPage.jsx'));
const DeveloperPage = lazy(() => import('../pages/public/DeveloperPage.jsx'));
const LessonsPage = lazy(() => import('../pages/public/LessonsPage.jsx'));
const LessonPage = lazy(() => import('../pages/public/LessonPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage.jsx'));
const AdminPage = lazy(() => import('../pages/admin/AdminPage.jsx'));

export default function App() {
    return (
        <Suspense
            fallback={
                <div className="route-loading" role="status" aria-live="polite">
                    Loading archive…
                </div>
            }
        >
            <Routes>
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/browse" element={<BrowsePage />} />
                    <Route path="/browse/:classSlug" element={<BrowsePage />} />
                    <Route path="/browse/:classSlug/:year" element={<BrowsePage />} />
                    <Route path="/browse/:classSlug/:year/:subjectId" element={<BrowsePage />} />
                    <Route path="/exam/:classSlug/:year/:subjectId" element={<ExamPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/developer" element={<DeveloperPage />} />
                    <Route path="/lessons" element={<LessonsPage />} />
                    <Route path="/lesson/:classSlug/:subjectSlug/:lessonSlug" element={<LessonPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="/admin/*" element={<AdminPage />} />
            </Routes>
        </Suspense>
    );
}
