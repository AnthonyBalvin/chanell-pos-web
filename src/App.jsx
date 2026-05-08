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
import Titlebar from './components/Titlebar';

export default function App() {
  const { user, role, loading } = useAuth();
  const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

  if (loading) return <div className="min-h-screen bg-[#0B1F3B] flex items-center justify-center text-white">Iniciando sistema...</div>;

  const appContent = (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <Navigate to="/login" replace /> : ((role === 'admin' || role === 'supervisor') ? <Navigate to="/admin" replace /> : <Navigate to="/vendedor" replace />)} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/admin" element={(role === 'admin' || role === 'supervisor') ? <AdminLayout /> : <Navigate to="/" replace />}>
          <Route index element={<DashboardAdmin />} />
          <Route path="caja" element={<PosAdmin />} />
          <Route path="productos" element={<ProductsAdmin />} />
          <Route path="ventas" element={<OrdersAdmin />} />
          <Route path="proveedores" element={<ProveedoresAdmin />} />
          <Route path="compras" element={<ComprasAdmin />} />
          <Route path="clientes" element={<ClientesAdmin />} />
          <Route path="configuracion" element={<ConfigAdmin />} />
          <Route path="pedidos-web" element={<PedidosWebAdmin />} />
          <Route path="usuarios" element={role === 'admin' ? <UsersAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="kardex" element={role === 'admin' ? <KardexAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="arqueos" element={role === 'admin' ? <ArqueosAdmin /> : <Navigate to="/admin" replace />} />
          <Route path="reportes" element={role === 'admin' ? <ReportesAdmin /> : <Navigate to="/admin" replace />} />
        </Route>

        <Route path="/vendedor" element={role === 'vendedor' ? <DashboardVendedor /> : <Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );

  if (isTauri) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[#0B1F3B]">
        <Titlebar />
        {/* Aquí está la magia: obligamos al contenido a medir calc(100vh - 40px) */}
        <div className="h-[calc(100vh-40px)] w-full relative">
          {appContent}
        </div>
      </div>
    );
  }

  return appContent;
}