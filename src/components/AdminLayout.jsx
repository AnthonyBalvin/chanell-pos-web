import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
    LogOut, Users, User, LayoutDashboard, ClipboardList, ChevronRight,
    Package, Menu, X, Store, Wallet, FileStack, Truck, ShoppingCart,
    Settings, Globe, Bell, BarChart3, AlertTriangle, KeyRound, ChevronDown,
    RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { useChanellUI } from '../context/UIContext';

export default function AdminLayout() {
    const { user, role } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { confirm, notify } = useChanellUI();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [stockAlertas, setStockAlertas] = useState([]);
    const [loadingAlertas, setLoadingAlertas] = useState(true);
    const [alertasNoVistas, setAlertasNoVistas] = useState(0);

    // Cambio de contraseña
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);

    const bellRef = useRef(null);
    const profileRef = useRef(null);

    // Cerrar dropdowns al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (bellRef.current && !bellRef.current.contains(e.target)) setShowNotifications(false);
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
                setShowPasswordForm(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cargar alertas de stock
    useEffect(() => {
        fetchStockAlertas();
    }, []);

    const fetchStockAlertas = async () => {
        setLoadingAlertas(true);
        const { data } = await supabase
            .from('productos')
            .select('id, name, stock, stock_minimo, category')
            .order('stock', { ascending: true });

        if (data) {
            const alertas = data.filter(p => p.stock <= (p.stock_minimo || 5));
            setStockAlertas(alertas);

            // Calcular cuántas son nuevas (no vistas antes)
            const vistasStr = localStorage.getItem('chanell_alertas_vistas') || '[]';
            const vistas = JSON.parse(vistasStr);
            // Una alerta es "nueva" si su ID+stock no estaba en las vistas
            const nuevas = alertas.filter(a => !vistas.includes(`${a.id}-${a.stock}`));
            setAlertasNoVistas(nuevas.length);
        }
        setLoadingAlertas(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) return notify('La contraseña debe tener al menos 6 caracteres.', 'warning');
        if (newPassword !== confirmPassword) return notify('Las contraseñas no coinciden.', 'warning');
        setChangingPassword(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setChangingPassword(false);
        if (error) {
            notify('Error al cambiar contraseña: ' + error.message, 'error');
        } else {
            notify('¡Contraseña actualizada exitosamente!', 'success');
            setNewPassword('');
            setConfirmPassword('');
            setShowNewPwd(false);
            setShowConfirmPwd(false);
            setShowPasswordForm(false);
            setShowProfile(false);
        }
    };

    // Marcar alertas como vistas al abrir el panel
    const handleOpenNotifications = () => {
        setShowNotifications(!showNotifications);
        setShowProfile(false);
        if (!showNotifications) {
            // Guardar las alertas actuales como vistas
            const vistas = stockAlertas.map(a => `${a.id}-${a.stock}`);
            localStorage.setItem('chanell_alertas_vistas', JSON.stringify(vistas));
            setAlertasNoVistas(0);
        }
    };

    const menuItems = [
        { icon: <LayoutDashboard size={18} />, label: "Dashboard", path: "/admin", roles: ['admin', 'supervisor'] },
        { icon: <Store size={18} />, label: "Caja (POS)", path: "/admin/caja", roles: ['admin', 'supervisor', 'vendedor'] },
        { icon: <Globe size={18} />, label: "Pedidos Web", path: "/admin/pedidos-web", roles: ['admin', 'supervisor', 'vendedor'] },
        { icon: <ClipboardList size={18} />, label: "Ventas", path: "/admin/ventas", roles: ['admin', 'supervisor', 'vendedor'] },
        { icon: <Package size={18} />, label: "Productos", path: "/admin/productos", roles: ['admin', 'supervisor'] },
        { icon: <FileStack size={18} />, label: "Kardex", path: "/admin/kardex", roles: ['admin'] },
        { icon: <ShoppingCart size={18} />, label: "Compras", path: "/admin/compras", roles: ['admin', 'supervisor'] },
        { icon: <Truck size={18} />, label: "Proveedores", path: "/admin/proveedores", roles: ['admin', 'supervisor'] },
        { icon: <Users size={18} />, label: "Clientes", path: "/admin/clientes", roles: ['admin', 'supervisor', 'vendedor'] },
        { icon: <Wallet size={18} />, label: "Arqueos", path: "/admin/arqueos", roles: ['admin'] },
        { icon: <User size={18} />, label: "Usuarios", path: "/admin/usuarios", roles: ['admin'] },
        { icon: <Settings size={18} />, label: "Configuración", path: "/admin/configuracion", roles: ['admin', 'supervisor'] },
        { icon: <BarChart3 size={18} />, label: "Reportes", path: "/admin/reportes", roles: ['admin', 'supervisor'] },
    ];

    const visibleMenuItems = menuItems.filter(item => item.roles.includes(role));

    const getPageTitle = (path) => {
        if (path === '/admin') return 'Dashboard';
        if (path.includes('/usuarios')) return 'Usuarios';
        if (path.includes('/ventas')) return 'Ventas';
        if (path.includes('/productos')) return 'Productos';
        if (path.includes('/caja')) return 'Punto de Venta';
        if (path.includes('/arqueos')) return 'Arqueos';
        if (path.includes('/kardex')) return 'Kardex';
        if (path.includes('/proveedores')) return 'Proveedores';
        if (path.includes('/compras')) return 'Compras';
        if (path.includes('/clientes')) return 'Clientes';
        if (path.includes('/pedidos-web')) return 'Pedidos Web';
        if (path.includes('/configuracion')) return 'Configuración';
        if (path.includes('/reportes')) return 'Reportes';
        return 'Panel';
    };

    const handleLogout = async () => {
        const isConfirmed = await confirm("Cerrar Sesión", "¿Seguro que deseas salir del sistema?", true);
        if (isConfirmed) {
            await supabase.auth.signOut();
        }
    };

    const nombreUsuario = user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Administrador';
    const iniciales = nombreUsuario.substring(0, 2).toUpperCase();

    return (
        <div className="flex h-screen bg-[#f4f6f9] text-slate-800 font-sans overflow-hidden">
            {/* OVERLAY MÓVIL */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* SIDEBAR CORPORATIVO */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1e2a4a] text-white flex flex-col shadow-xl lg:shadow-none transition-transform duration-300
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
            >
                {/* LOGO AREA */}
                <div className="pt-10 pb-6 flex items-center justify-center shrink-0 relative">
                    <div className="flex flex-col items-center">
                        <span className="font-black text-3xl tracking-tight text-[#ec4899] leading-none">Chanell</span>
                        <span className="font-bold text-[11px] tracking-[0.25em] text-[#3b82f6] uppercase mt-1.5 ml-1">Tecnología</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden absolute right-4 top-6 text-white/50 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 py-6 overflow-y-auto custom-scrollbar">
                    <ul className="space-y-1.5 px-4">
                        {visibleMenuItems.map((item) => {
                            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                            return (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`group relative flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${isActive
                                            ? 'bg-[#3b82f6] text-white shadow-md shadow-[#3b82f6]/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-[60%] bg-white rounded-r-md"></div>
                                        )}
                                        <span className={`transition-transform duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                            {item.icon}
                                        </span>
                                        <span className="tracking-wide">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* FOOTER SIDEBAR */}
                <div className="p-6 shrink-0">
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-colors text-sm font-medium border border-white/5"
                    >
                        <LogOut size={18} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f4f6f9]">

                {/* HEADER CORPORATIVO */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden text-slate-500 hover:text-slate-800 p-2 -ml-2 rounded"
                        >
                            <Menu size={20} />
                        </button>

                        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 font-medium">
                            <span>Panel</span>
                            <ChevronRight size={14} className="text-slate-400" />
                            <span className="text-slate-800 font-bold uppercase tracking-wide">
                                {getPageTitle(location.pathname)}
                            </span>
                        </div>
                        <span className="sm:hidden text-slate-800 font-bold uppercase tracking-wide text-sm">
                            {getPageTitle(location.pathname)}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4">

                        {/* ======= CAMPANA DE NOTIFICACIONES ======= */}
                        <div className="relative" ref={bellRef}>
                            <button
                                onClick={handleOpenNotifications}
                                className="relative p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <Bell size={20} />
                                {alertasNoVistas > 0 && (
                                    <span className="absolute top-1 right-1 w-4 h-4 bg-[#ec4899] rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-black animate-pulse">
                                        {alertasNoVistas > 9 ? '9+' : alertasNoVistas}
                                    </span>
                                )}
                            </button>

                            {/* Panel de Notificaciones */}
                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Header del panel */}
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 bg-[#f4f6f9]/80">
                                        <div className="flex items-center gap-2">
                                            <Bell size={14} className="text-[#ec4899]" />
                                            <span className="text-xs font-black text-[#1e2a4a] uppercase tracking-widest">Alertas de Stock</span>
                                        </div>
                                        <button
                                            onClick={fetchStockAlertas}
                                            className="text-slate-400 hover:text-[#3b82f6] transition-colors p-1 rounded-lg hover:bg-slate-100"
                                            title="Actualizar"
                                        >
                                            <RefreshCw size={13} />
                                        </button>
                                    </div>

                                    <div className="max-h-72 overflow-y-auto">
                                        {loadingAlertas ? (
                                            <div className="flex justify-center py-8">
                                                <div className="w-5 h-5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : stockAlertas.length === 0 ? (
                                            <div className="text-center py-8 px-4">
                                                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Package size={20} className="text-emerald-500" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-600">Todo en orden</p>
                                                <p className="text-xs text-slate-400 mt-1">Sin productos con stock crítico</p>
                                            </div>
                                        ) : (
                                            stockAlertas.map((p) => {
                                                const esCero = p.stock === 0;
                                                return (
                                                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${esCero ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'}`}>
                                                            <AlertTriangle size={14} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-[#1e2a4a] truncate">{p.name}</p>
                                                            <p className={`text-[11px] font-black ${esCero ? 'text-red-500' : 'text-amber-500'}`}>
                                                                {esCero ? 'SIN STOCK' : `Stock: ${p.stock} u.`}
                                                            </p>
                                                        </div>
                                                        <Link
                                                            to="/admin/productos"
                                                            onClick={() => setShowNotifications(false)}
                                                            className="text-[10px] font-black text-[#3b82f6] hover:underline shrink-0"
                                                        >
                                                            Ver →
                                                        </Link>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {stockAlertas.length > 0 && (
                                        <div className="px-4 py-2.5 border-t border-slate-50 bg-[#f4f6f9]/50">
                                            <Link
                                                to="/admin/productos"
                                                onClick={() => setShowNotifications(false)}
                                                className="text-xs font-black text-[#ec4899] hover:text-pink-700 transition-colors"
                                            >
                                                Ver todos los productos →
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                        {/* ======= PERFIL / DROPDOWN ======= */}
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
                                className="flex items-center gap-2.5 cursor-pointer group rounded-xl px-2 py-1.5 hover:bg-slate-100 transition-all"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-[#3b82f6] transition-colors">{nombreUsuario}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{role}</p>
                                </div>
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm"
                                    style={{ background: 'linear-gradient(135deg, #ec4899, #3b82f6)' }}>
                                    {iniciales}
                                </div>
                                <ChevronDown size={14} className={`text-slate-400 hidden sm:block transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown del perfil */}
                            {showProfile && (
                                <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Info usuario */}
                                    <div className="px-4 py-4 bg-gradient-to-br from-[#1e2a4a] to-[#3b82f6] flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 border-2 border-white/30"
                                            style={{ background: 'rgba(236,72,153,0.6)' }}>
                                            {iniciales}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate">{nombreUsuario}</p>
                                            <p className="text-[11px] text-blue-200 truncate">{user?.email}</p>
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-[#ec4899]/30 text-[#ec4899] px-2 py-0.5 rounded-full mt-1 inline-block border border-[#ec4899]/20">
                                                {role}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Opciones */}
                                    <div className="p-2">
                                        {!showPasswordForm ? (
                                            <>
                                                <button
                                                    onClick={() => setShowPasswordForm(true)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 hover:text-[#1e2a4a] transition-colors text-left group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#3b82f6]/10 flex items-center justify-center transition-colors">
                                                        <KeyRound size={15} className="text-slate-500 group-hover:text-[#3b82f6]" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold">Cambiar contraseña</p>
                                                        <p className="text-[10px] text-slate-400">Actualiza tu acceso</p>
                                                    </div>
                                                </button>

                                                <div className="h-px bg-slate-100 my-1.5 mx-2" />

                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors text-left group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-red-100 flex items-center justify-center transition-colors">
                                                        <LogOut size={15} className="text-slate-500 group-hover:text-red-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold">Cerrar sesión</p>
                                                        <p className="text-[10px] text-slate-400">Salir del sistema</p>
                                                    </div>
                                                </button>
                                            </>
                                        ) : (
                                            /* Formulario cambio de contraseña */
                                            <form onSubmit={handleChangePassword} className="p-2 space-y-3">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowPasswordForm(false); setShowNewPwd(false); setShowConfirmPwd(false); }}
                                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors mb-1"
                                                >
                                                    ← Volver
                                                </button>
                                                <p className="text-xs font-black text-[#1e2a4a] uppercase tracking-widest">Nueva contraseña</p>
                                                <div className="relative">
                                                    <input
                                                        type={showNewPwd ? 'text' : 'password'}
                                                        placeholder="Mínimo 6 caracteres"
                                                        value={newPassword}
                                                        onChange={e => setNewPassword(e.target.value)}
                                                        className="w-full bg-[#f4f6f9] border border-transparent focus:border-[#3b82f6] text-[#1e2a4a] text-xs font-medium rounded-xl px-3 py-2.5 pr-9 outline-none transition-all"
                                                        required
                                                    />
                                                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                                                        {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type={showConfirmPwd ? 'text' : 'password'}
                                                        placeholder="Confirmar contraseña"
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        className="w-full bg-[#f4f6f9] border border-transparent focus:border-[#3b82f6] text-[#1e2a4a] text-xs font-medium rounded-xl px-3 py-2.5 pr-9 outline-none transition-all"
                                                        required
                                                    />
                                                    <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors">
                                                        {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={changingPassword}
                                                    className="w-full py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-60"
                                                    style={{ background: 'linear-gradient(135deg, #ec4899, #3b82f6)' }}
                                                >
                                                    {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                                                </button>
                                            </form>
                                        )}
                                    </div>

                                    <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/50">
                                        <p className="text-[10px] text-slate-400 text-center">Chanell Tecnología © {new Date().getFullYear()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* ÁREA DE RENDERIZADO */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 lg:px-10">
                    <div className="w-full h-full animate-in fade-in duration-500">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}