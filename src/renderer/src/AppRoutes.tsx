import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import App from './App'
import PicturePage from './pages/Picture/PicturePage'

export default function AppRoutes(): JSX.Element {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/pictures" element={<>Pictures</>} />
        <Route path="/pictures/:id" element={<PicturePage />} />
        <Route path="/easter-egg" element={<>Mis huevos</>} />
      </Routes>
    </Router>
  )
}
