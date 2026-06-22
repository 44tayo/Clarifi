import React from 'react'
import ReactDOM from 'react-dom/client'
import Overlay from './overlay'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
)

void window.electronAPI?.invoke('overlay:set-interactive', true)
void window.electronAPI?.invoke('overlay:ready')
