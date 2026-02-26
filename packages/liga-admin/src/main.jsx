import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import router from "./app/routes.jsx"; 
import './index.css'
import { AuthProvider } from "./context/AuthContext.jsx";
import { RootErrorBoundary } from "./components/errors/RootErrorBoundary.jsx";
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
