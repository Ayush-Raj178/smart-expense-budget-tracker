import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <FeatureFlagsProvider>
          <App />
        </FeatureFlagsProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
