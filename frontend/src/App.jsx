import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import CustomerPage from './pages/CustomerPage'
import VendorPage from './pages/VendorPage'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="nav-brand">
            <span className="brand-icon">📍</span>
            <span className="brand-name">GeoLocate</span>
            <span className="brand-badge">MVP</span>
          </div>
          <div className="nav-links">
            <NavLink
              to="/customer"
              id="nav-customer"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon-inline">✏️</span>
              Customer
            </NavLink>
            <NavLink
              to="/vendor"
              id="nav-vendor"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon-inline">🗺️</span>
              Vendor Map
            </NavLink>
          </div>
        </nav>

        {/* ── Pages ── */}
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/customer" replace />} />
            <Route path="/customer" element={<CustomerPage />} />
            <Route path="/vendor" element={<VendorPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
