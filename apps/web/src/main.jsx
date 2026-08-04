import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { CompanyProvider } from './context/CompanyContext'
import './app/index.css'
import App from './app/App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min default
      retry: 2,
    },
  },
})

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  console.warn("⚠️ VITE_CLERK_PUBLISHABLE_KEY no está configurada en .env.local");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CompanyProvider>
            <App />
          </CompanyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
)
