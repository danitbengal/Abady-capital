import React from 'react'
import ReactDOM from 'react-dom/client'
import { CapitalPrototype } from './capital/CapitalPrototype'
import { ProductionGateway } from './production/ProductionGateway'
import './base.css'

const secureMode = new URLSearchParams(window.location.search).get('mode') === 'secure'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{secureMode ? <ProductionGateway /> : <CapitalPrototype />}</React.StrictMode>,
)
