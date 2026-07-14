import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { AuthProvider } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import './app/index.css'
import App from './app/App.jsx'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  console.warn("⚠️ VITE_CLERK_PUBLISHABLE_KEY no está configurada en .env.local");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <AuthProvider>
        <CompanyProvider>
          <App />
        </CompanyProvider>
      </AuthProvider>
    </ClerkProvider>
  </StrictMode>,
)
