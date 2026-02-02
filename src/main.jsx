import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/react-query'

import './index.css'
import App from './App.jsx'
import { SidebarProvider } from './components/ui/sidebar'
import { ThemeProvider } from './components/misc/theme-provider'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <SidebarProvider>
          <BrowserRouter>
            <TooltipProvider>
              <App />
            </TooltipProvider>
            <Toaster />
          </BrowserRouter>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
