import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import router from "./app/routes.jsx"; 
import './index.css'
import { AuthProvider } from "./context/AuthContext.jsx";
createRoot(document.getElementById('root')).render(
  <StrictMode>
     <AuthProvider>
        <RouterProvider router={router} />
     </AuthProvider>    
  </StrictMode>,
)
