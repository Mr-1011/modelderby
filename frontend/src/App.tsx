import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Shell from './components/Shell'
import Admin from './pages/Admin'
import Board from './pages/Board'
import Home from './pages/Home'
import { Privacy, Terms } from './pages/Legal'
import Leaderboard from './pages/Leaderboard'
import Ops from './pages/Ops'
import Phone from './pages/Phone'
import Profile from './pages/Profile'
import RacePage from './pages/RacePage'
import SignIn from './pages/SignIn'
import Support from './pages/Support'

export default function App() {
  const { pathname, search } = useLocation()
  // The fake race for design work, only with the demo parameter.
  if (pathname === '/' && new URLSearchParams(search).has('demo')) return <Phone />
  return (
    <Routes>
      <Route path="/board" element={<Board />} />
      {/* The ops view shows tool calls of hidden challenges, so it exists only on a local server. */}
      {import.meta.env.DEV && <Route path="/ops" element={<Ops />} />}
      <Route path="/signin" element={<SignIn />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/race/:id" element={<RacePage />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<Support />} />
      </Route>
      {/* An old link, for example /join of a QR code, goes to the race list. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
