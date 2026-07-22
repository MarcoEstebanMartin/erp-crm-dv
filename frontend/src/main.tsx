import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ReceiptView from './components/ReceiptView.tsx'
import { ConfirmProvider } from './context/ConfirmContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/recibo/:id" element={<ReceiptView />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  </StrictMode>,
)
