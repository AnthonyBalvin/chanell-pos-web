import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/UIContext.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <NotificationProvider>
      <StrictMode>
        <App />
      </StrictMode>
    </NotificationProvider>
  </AuthProvider>,
)
