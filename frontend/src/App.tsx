import { Route, Routes } from 'react-router-dom'
import Board from './pages/Board'
import Phone from './pages/Phone'
import Submit from './pages/Submit'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Phone />} />
      <Route path="/board" element={<Board />} />
      <Route path="/submit" element={<Submit />} />
    </Routes>
  )
}
