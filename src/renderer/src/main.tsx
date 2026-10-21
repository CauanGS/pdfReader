import { createRoot } from 'react-dom/client'
import 'pdfjs-dist/web/pdf_viewer.css'
import './styles.css'
import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado')

createRoot(container).render(<App />)
