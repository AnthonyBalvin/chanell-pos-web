import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import UsersAdmin from './pages/UsersAdmin';
import DashboardVendedor from './pages/DashboardVendedor';
import AdminLayout from './components/AdminLayout';
import OrdersAdmin from './pages/OrdersAdmin';
import ProductsAdmin from './pages/ProductsAdmin';
import PosAdmin from './components/PosAdmin';
import DashboardAdmin from './pages/DashboardAdmin';
import ArqueosAdmin from './pages/ArqueosAdmin';
import KardexAdmin from './pages/KardexAdmin';
import ClientesAdmin from './pages/ClientesAdmin';
import ProveedoresAdmin from './pages/ProveedoresAdmin';
import ComprasAdmin from './pages/ComprasAdmin';
import ResetPassword from './pages/ResetPassword';
import ConfigAdmin from './pages/ConfigAdmin';
import PedidosWebAdmin from './pages/PedidosWebAdmin';
import ReportesAdmin from './pages/ReportesAdmin';

export default function App() {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-brand-navy flex items-center justify-center text-brand-accent">Iniciando sistema...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* CORRECCIÓN: Si es admin o supervisor, van a /admin. Si no, a /vendedor */}
        <Route path="/" element={!user ? <Navigate to="/login" replace /> : ((role === 'admin' || role === 'supervisor') ? <Navigate to="/admin" replace /> : <Navigate to="/vendedor" replace />)} />

        {/* RUTAS PÚBLICAS (No requieren sesión activa) */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* RUTAS DEL PANEL DE ADMINISTRACIÓN / SUPERVISIÓN */}
        <Route
          path="/admin"
          element={(role === 'admin' || role === 'supervisor') ? <AdminLayout /> : <Navigate to="/" replace />}
        >
          <Route index element={<DashboardAdmin />} />
          <Route path="caja" element={<PosAdmin />} />
          <Route path="productos" element={<ProductsAdmin />} />
          <Route path="ventas" element={<OrdersAdmin />} />
          <Route path="proveedores" element={<ProveedoresAdmin />} />
          <Route path="compras" element={<ComprasAdmin />} />
          <Route path="clientes" element={<ClientesAdmin />} /> {/* Agregado Clientes */}
          <Route path="configuracion" element={<ConfigAdmin />} />
          <Route path="pedidos-web" element={<PedidosWebAdmin />} />

          {/* SOLO ACCESIBLES POR EL ADMIN (Protección extra) */}
          <Route path="usuarios" element={role === 'admin' ? <UsersAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="kardex" element={role === 'admin' ? <KardexAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="arqueos" element={role === 'admin' ? <ArqueosAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="reportes" element={role === 'admin' ? <ReportesAdmin /> : <Navigate to="/admin" replace />} />
        </Route>

        {/* RUTAS DEL VENDEDOR */}
        <Route path="/vendedor" element={role === 'vendedor' ? <DashboardVendedor /> : <Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}