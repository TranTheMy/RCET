import RouterCustom from './router'
import './App.css'
import { Toaster } from 'react-hot-toast'
import AIAssistant from './components/AIAssistant'
import GuestInfoChatbot from './components/GuestInfoChatbot'
import ScrollToTop from './components/ScrollToTop'
import AISelectionExplainer from './components/AISelectionExplainer'
import GlobalRealtimeBridge from './components/GlobalRealtimeBridge'

function App() {
  return (
    <>
      <AISelectionExplainer />
      <ScrollToTop />
      <GlobalRealtimeBridge />
      <RouterCustom />
      <GuestInfoChatbot />
      <AIAssistant />
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '14px', borderRadius: '12px' } }} />
    </>
  )
}

export default App
