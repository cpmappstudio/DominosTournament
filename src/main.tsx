import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import './custom-sidebar.css'
import App from './App.tsx'

// Initialize theme before rendering
const initializeTheme = () => {
  // Check saved theme preference (defaults to dark mode)
  const savedTheme = localStorage.getItem('theme');
  
  // Default to dark mode unless explicitly set to light
  const useDarkMode = savedTheme !== 'light';
  
  if (useDarkMode) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
};

// Apply theme immediately
initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
