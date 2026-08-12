import { HashRouter as Router, Route, Routes } from 'react-router-dom'
import HomePage from './pages/Home/HomePage'
import GalleryPage from './pages/Gallery/GalleryPage'
import { PATH } from './app.routes.const'
import MediaPage from './pages/Media/MediaPage'
import AddMediaPage from './pages/Media/AddMediaPage'
import PendingEntryPage from './pages/Pending/PendingEntryPage'
import SettingsPage from './pages/Settings/SettingsPage'
import ManagePage from './pages/Manage/ManagePage'
import NotFoundPage from './pages/NotFound/NotFoundPage'
import { AppHeader } from './components/AppHeader'

export default function AppRoutes(): JSX.Element {
  return (
    <Router>
      <div className="app-shell">
        <AppHeader />
        <div className="app-content">
          <Routes>
            <Route path={PATH.HOME} element={<HomePage />} />
            <Route path={PATH.GALLERY} element={<GalleryPage />} />
            <Route path={PATH.MEDIA} element={<MediaPage />} />
            <Route path={PATH.ADD_MEDIA} element={<AddMediaPage />} />
            <Route path={PATH.PENDING} element={<PendingEntryPage />} />
            <Route path={PATH.SETTINGS} element={<SettingsPage />} />
            <Route path={PATH.MANAGE} element={<ManagePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}
