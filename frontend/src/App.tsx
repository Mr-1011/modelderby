import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Shell from './components/Shell'
import Arena from './pages/Arena'
import Board from './pages/Board'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Phone from './pages/Phone'
import RacePage from './pages/RacePage'

export default function App() {
  const { pathname, search } = useLocation()
  // The fake race for design work, only with the demo parameter.
  if (pathname === '/' && new URLSearchParams(search).has('demo')) return <Phone />
  return (
    <Routes>
      <Route path="/board" element={<Board />} />
      <Route path="/race/:id" element={<RacePage />} />
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/arena" element={<Arena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Route>
      <Route path="/submit" element={<Navigate to="/arena" replace />} />
    </Routes>
  )
}
