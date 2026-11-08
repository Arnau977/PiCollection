import {
  createHashRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider
} from 'react-router-dom'
import HomePage from './pages/Home/HomePage'
import GalleryPage from './pages/Gallery/GalleryPage'
import FilterListsPage from './pages/FilterLists/FilterListsPage'
import { PATH } from './app.routes.const'
import MediaPage from './pages/Media/MediaPage/MediaPage'
import AddMediaPage from './pages/Media/AddMediaPage/AddMediaPage'
import PendingEntryPage from './pages/Pending/PendingEntryPage'
import SettingsPage from './pages/Settings/SettingsPage'
import ManagePage from './pages/Manage/ManagePage'
import DiscardedPage from './pages/Storage/DiscardedPage'
import StoragePage from './pages/Storage/StoragePage'
import NotFoundPage from './pages/NotFound/NotFoundPage'
import { AppHeader } from './components/AppHeader/AppHeader'
import { ContextMenuHost } from './components/ContextMenu/ContextMenuHost'

function AppShell(): JSX.Element {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-content">
        <Outlet />
      </div>
      <ContextMenuHost />
    </div>
  )
}

// A data router, since only those can hold a navigation back (LeaveGuard).
const router = createHashRouter(
  createRoutesFromElements(
    <Route element={<AppShell />}>
      <Route path={PATH.HOME} element={<HomePage />} />
      <Route path={PATH.GALLERY} element={<GalleryPage />} />
      <Route path={PATH.FILTER_LISTS} element={<FilterListsPage />} />
      <Route path={PATH.MEDIA} element={<MediaPage />} />
      <Route path={PATH.ADD_MEDIA} element={<AddMediaPage />} />
      <Route path={PATH.PENDING} element={<PendingEntryPage />} />
      <Route path={PATH.SETTINGS} element={<SettingsPage />} />
      <Route path={PATH.MANAGE} element={<ManagePage />} />
      <Route path={PATH.STORAGE} element={<StoragePage />} />
      <Route path={PATH.DISCARDED} element={<DiscardedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  )
)

export default function AppRoutes(): JSX.Element {
  return <RouterProvider router={router} />
}
