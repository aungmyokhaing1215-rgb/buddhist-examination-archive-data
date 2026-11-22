import { Route, Routes } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout.jsx'
import HomePage from '../pages/public/HomePage.jsx'
import BrowsePage from '../pages/public/BrowsePage.jsx'
import ExamPage from '../pages/public/ExamPage.jsx'
import AdminPage from '../pages/admin/AdminPage.jsx'

export default function App() {
  return <Routes><Route element={<PublicLayout />}><Route path="/" element={<HomePage />} /><Route path="/browse/:classSlug?/:year?/:subjectId?" element={<BrowsePage />} /><Route path="/exam/:classSlug/:year/:subjectId" element={<ExamPage />} /></Route><Route path="/admin/*" element={<AdminPage />} /><Route path="*" element={<HomePage />} /></Routes>
}
