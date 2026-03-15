import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './App.jsx'
import { PlayerAuthProvider } from './context/PlayerAuthContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PlayerAuthProvider>
      <RouterProvider router={router} />
    </PlayerAuthProvider>
  </StrictMode>,
)
