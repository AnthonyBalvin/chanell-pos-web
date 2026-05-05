import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Package, Truck, Eye, Search, X, MapPin, User, Store, Filter, Calendar, Tag, Download, FileText, Globe, XCircle, Loader2, TrendingUp, Clock, AlertCircle, Wallet, Printer, ChevronDown, CheckCircle2, CreditCard, FileSpreadsheet } from 'lucide-react';
import gsap from 'gsap';
import { generateSummaryPDF, generateIndividualPDF, printThermalTicket } from '../utils/pdfGenerator';
import { exportarVentasExcel } from '../utils/excelGenerator';
import { useChanellUI } from '../context/UIContext';

export default function OrdersAdmin() {
    const { notify, confirm } = useChanellUI();
    const { user, role } = useAuth();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeShift, setActiveShift] = useState(null);

    // --- ESTADOS DE PAGINACIÓN ---
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEM_PER_PAGE = 50;

    // --- ESTADOS DE FILTRO ---
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [logisticFilter, setLogisticFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [exactDate, setExactDate] = useState('');

    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const modalRef = useRef(null);
    const overlayRef = useRef(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [orderToSell, setOrderToSell] = useState(null);
    const [isProcessingSale, setIsProcessingSale] = useState(false);
    const [isAnuling, setIsAnuling] = useState(false);

    useEffect(() => {
        const checkTurno = async () => {
            if (!user) return;
            const { data } = await supabase.from('turnos_caja').select('*').eq('usuario_id', user.id).eq('estado', 'abierto').single();
            if (data) setActiveShift(data);
        };
        checkTurno();
    }, [user]);

    // =========================================================================
    // LÓGICA DE CARGA CON PAGINACIÓN Y FILTROS (SERVER-SIDE)
    // =========================================================================
    const fetchPedidos = async (reset = false) => {
        if (reset) {
            setLoading(true);
            setPage(0);
        } else {
            setLoadingMore(true);
        }

        const currentPage = reset ? 0 : page + 1;
        const from = currentPage * ITEM_PER_PAGE;
        const to = from + ITEM_PER_PAGE - 1;

        let query = supabase
            .from('pedidos')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (statusFilter !== 'all') query = query.eq('estado', statusFilter);
        if (logisticFilter !== 'all') query = query.eq('metodo_entrega', logisticFilter);
        if (paymentFilter !== 'all') query = query.eq('metodo_pago', paymentFilter);

        if (dateFilter !== 'all') {
            const today = new Date();
            if (dateFilter === 'today') {
                const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
                query = query.gte('created_at', startOfDay);
            } else if (dateFilter === 'week') {
                const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();
                query = query.gte('created_at', startOfWeek);
            } else if (dateFilter === 'month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
                query = query.gte('created_at', startOfMonth);
            } else if (dateFilter === 'exact' && exactDate) {
                const startExact = new Date(`${exactDate}T00:00:00`).toISOString();
                const endExact = new Date(`${exactDate}T23:59:59`).toISOString();
                query = query.gte('created_at', startExact).lte('created_at', endExact);
            }
        }

        if (filter) {
            query = query.or(`ticket.ilike.%${filter}%,cliente_nombre.ilike.%${filter}%,cliente_dni_ruc.ilike.%${filter}%`);
        }

        const { data, error, count } = await query;

        if (!error && data) {
            setPedidos(prev => reset ? data : [...prev, ...data]);
            setHasMore(from + data.length < count);
            if (!reset) setPage(currentPage);
        } else {
            console.error("Error al cargar pedidos:", error);
        }

        setLoading(false);
        setLoadingMore(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPedidos(true);
        }, 400);
        return () => clearTimeout(timer);
    }, [filter, statusFilter, logisticFilter, paymentFilter, dateFilter, exactDate]);

    // =========================================================================
    // OPTIMIZACIÓN DE MEMORIA (KPIs con useMemo)
    // =========================================================================
    const stats = useMemo(() => {
        const today = new Date();
        const currentMonthOrders = pedidos.filter(p => {
            const d = new Date(p.created_at);
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        });

        return {
            ventasMes: currentMonthOrders.filter(p => p.estado === 'vendido').reduce((sum, p) => sum + (p.total || 0), 0),
            pendientes: currentMonthOrders.filter(p => p.estado === 'pendiente').length,
            anulados: currentMonthOrders.filter(p => p.estado === 'anulado').length
        };
    }, [pedidos]);

    // --- FUNCIONES DE OPERACIÓN ---
    const procesarAnulacion = async (pedido) => {
        if (role !== 'admin' && role !== 'supervisor') {
            notify("No tienes los permisos necesarios para anular tickets. Llama al supervisor.", "error");
            return;
        }

        const isConfirmed = await confirm("Anular Venta", `¿Estás seguro de ANULAR el ticket #${pedido.ticket}? Los productos regresarán al inventario.`, true);
        if (!isConfirmed) return;
        setIsAnuling(true);
        try {
            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Admin';

            for (const item of pedido.items) {
                const { data: prodData } = await supabase.from('productos').select('name, stock').eq('id', item.product.id).single();

                if (prodData) {
                    const stockAnterior = prodData.stock || 0;
                    const stockNuevo = stockAnterior + item.quantity;
                    await supabase.from('productos').update({ stock: stockNuevo }).eq('id', item.product.id);
                    await supabase.from('movimientos_inventario').insert({
                        producto_id: item.product.id,
                        producto_nombre: prodData.name || item.product.name,
                        tipo_movimiento: 'entrada',
                        cantidad: item.quantity,
                        stock_anterior: stockAnterior,
                        stock_nuevo: stockNuevo,
                        motivo: `Anulación de Ticket #${pedido.ticket}`,
                        usuario_id: user.id,
                        usuario_nombre: nombreUsuario
                    });
                }
            }
            const { error } = await supabase.from('pedidos').update({ estado: 'anulado' }).eq('id', pedido.id);
            if (error) throw error;

            notify("Ticket anulado. Inventario restaurado y registrado en el Kardex.", "success");
            fetchPedidos(true);
            setIsDetailsOpen(false);
        } catch (error) {
            notify("Error al anular: " + error.message, "error");
        } finally {
            setIsAnuling(false);
        }
    };

    const handleOpenPayment = (pedido) => {
        if (!activeShift && pedido.metodo_entrega === 'pickup') {
            notify("⚠️ Debes abrir tu caja en el POS primero para cobrar en tienda.", "error");
            return;
        }
        setOrderToSell(pedido);
        setIsPaymentModalOpen(true);
    };

    const ejecutarActualizacionVendido = async (pedido, destination) => {
        const nombresMetodos = {
            'efectivo': 'Efectivo (Caja Física)',
            'yape_pos': 'Yape / POS Tienda',
            'banco': 'Transferencia Bancaria'
        };
        const metodoAmigable = nombresMetodos[destination];

        const confirmacion = await confirm(
            "Oficializar Cobro",
            `💰 CONFIRMACIÓN DE COBRO\n\n¿Confirmas que ya recibiste S/ ${pedido.total?.toFixed(2)} mediante ${metodoAmigable}?\n\n⚠️ Al aceptar, se sumará el dinero a la caja y se descontará el stock del Kardex irreversiblemente.`,
            true
        );

        if (!confirmacion) return;

        setIsProcessingSale(true);
        try {
            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Cajero';

            let p_turno_id = null;
            let p_metodo_pago = pedido.metodo_pago;
            let p_metodo_entrega = pedido.metodo_entrega;
            let p_agencia = pedido.agencia;

            if (destination === 'efectivo') {
                p_turno_id = activeShift.id;
                p_metodo_pago = 'efectivo';
                p_metodo_entrega = 'pickup';
                p_agencia = null;
            } else if (destination === 'yape_pos') {
                p_turno_id = activeShift.id;
                p_metodo_pago = pedido.metodo_pago === 'efectivo' ? 'tarjeta' : pedido.metodo_pago;
                p_metodo_entrega = 'pickup';
                p_agencia = null;
            } else if (destination === 'banco') {
                p_metodo_pago = pedido.metodo_pago === 'efectivo' ? 'transferencia' : pedido.metodo_pago;
            }

            const { error: rpcError } = await supabase.rpc('cobrar_pedido_web_seguro', {
                p_pedido_id: pedido.id,
                p_turno_id: p_turno_id,
                p_metodo_pago: p_metodo_pago,
                p_metodo_entrega: p_metodo_entrega,
                p_agencia: p_agencia,
                p_usuario_id: user.id,
                p_usuario_nombre: nombreUsuario
            });

            if (rpcError) throw rpcError;

            gsap.to(`#row-${pedido.id}`, { backgroundColor: 'rgba(16, 185, 129, 0.15)', duration: 0.2, yoyo: true, repeat: 1 });
            fetchPedidos(true);

        } catch (error) {
            console.error("Error en RPC:", error);
            notify("Error crítico procesando el cobro: " + error.message, "error");
        } finally {
            setIsPaymentModalOpen(false);
            setIsProcessingSale(false);
        }
    };

    const openDetails = (pedido) => {
        setSelectedOrder(pedido);
        setIsDetailsOpen(true);
    };

    const closeDetails = () => {
        gsap.to(overlayRef.current, { opacity: 0, duration: 0.3, onComplete: () => setIsDetailsOpen(false) });
    };

    useEffect(() => {
        if (isDetailsOpen) {
            gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(modalRef.current, { scale: 0.95, opacity: 0, y: 15 }, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" });
        }
    }, [isDetailsOpen]);

    const handleExportExcel = async () => {
        notify("Generando archivo Excel... Esto puede tardar unos segundos.", "info");
        let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false });

        if (statusFilter !== 'all') query = query.eq('estado', statusFilter);
        if (logisticFilter !== 'all') query = query.eq('metodo_entrega', logisticFilter);
        if (paymentFilter !== 'all') query = query.eq('metodo_pago', paymentFilter);
        if (dateFilter !== 'all') {
            const today = new Date();
            if (dateFilter === 'today') {
                const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
                query = query.gte('created_at', startOfDay);
            } else if (dateFilter === 'week') {
                const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();
                query = query.gte('created_at', startOfWeek);
            } else if (dateFilter === 'month') {
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
                query = query.gte('created_at', startOfMonth);
            } else if (dateFilter === 'exact' && exactDate) {
                const startExact = new Date(`${exactDate}T00:00:00`).toISOString();
                const endExact = new Date(`${exactDate}T23:59:59`).toISOString();
                query = query.gte('created_at', startExact).lte('created_at', endExact);
            }
        }
        if (filter) query = query.or(`ticket.ilike.%${filter}%,cliente_nombre.ilike.%${filter}%,cliente_dni_ruc.ilike.%${filter}%`);

        const { data, error } = await query;
        if (error || !data) return notify("Error al exportar a Excel.", "error");

        exportarVentasExcel(data);
    };

    const handleExportFullPDF = async () => {
        notify("Generando PDF... Esto puede tardar unos segundos.", "info");
        let query = supabase.from('pedidos').select('*').order('created_at', { ascending: false });

        if (statusFilter !== 'all') query = query.eq('estado', statusFilter);
        if (logisticFilter !== 'all') query = query.eq('metodo_entrega', logisticFilter);
        if (paymentFilter !== 'all') query = query.eq('metodo_pago', paymentFilter);

        const { data, error } = await query;
        if (!error && data) generateSummaryPDF(data);
        else notify("Error al generar el reporte completo.", "error");
    };

    return (
        <div className="w-full space-y-6 pb-24 sm:pb-10 sm:px-4 animate-in fade-in duration-500">
            {/* CABECERA CON BOTONES DE EXPORTACIÓN */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Store className="text-[#3b82f6]" size={28} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Historial de Ventas</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">El registro auditable de todas las ventas físicas y web.</p>
                </div>
                {/* Ocultamos los botones de Exportar para el vendedor */}
                {(role === 'admin' || role === 'supervisor') && (
                    <div className="flex w-full md:w-auto gap-2">
                        <button onClick={handleExportFullPDF} className="flex-1 md:flex-none bg-[#1e2a4a] hover:bg-slate-800 text-white px-5 sm:px-6 py-3.5 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(30,42,74,0.3)] hover:-translate-y-0.5">
                            <FileText size={16} /> <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button onClick={handleExportExcel} className="flex-[2] md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-5 sm:px-6 py-3.5 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    </div>
                )}
            </div>

            {/* KPIS DE RENDIMIENTO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-500/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div><p className="text-slate-400 text-[9px] sm:text-[10px] font-black tracking-widest uppercase mb-1">Ventas del Mes</p><h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a]">S/ {stats.ventasMes.toFixed(2)}</h3></div>
                        <div className="p-2 sm:p-3 bg-emerald-50 rounded-xl sm:rounded-2xl text-emerald-500"><TrendingUp size={20} className="sm:w-6 sm:h-6" /></div>
                    </div>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-amber-500/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div><p className="text-slate-400 text-[9px] sm:text-[10px] font-black tracking-widest uppercase mb-1">Por Cobrar (Web)</p><h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a]">{stats.pendientes} <span className="text-[10px] sm:text-xs text-slate-500 font-bold">tickets</span></h3></div>
                        <div className="p-2 sm:p-3 bg-amber-50 rounded-xl sm:rounded-2xl text-amber-500"><Clock size={20} className="sm:w-6 sm:h-6" /></div>
                    </div>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-red-500/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10 flex justify-between items-start">
                        <div><p className="text-slate-400 text-[9px] sm:text-[10px] font-black tracking-widest uppercase mb-1">Anulados</p><h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a]">{stats.anulados} <span className="text-[10px] sm:text-xs text-slate-500 font-bold">tickets</span></h3></div>
                        <div className="p-2 sm:p-3 bg-red-50 rounded-xl sm:rounded-2xl text-red-500"><AlertCircle size={20} className="sm:w-6 sm:h-6" /></div>
                    </div>
                </div>
            </div>

            {/* FILTROS MEJORADOS */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col md:flex-row items-center gap-3">
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text" placeholder="Buscar ticket o cliente..."
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium outline-none focus:bg-white focus:border-[#ec4899] text-[#1e2a4a] transition-all placeholder:text-slate-400"
                        value={filter} onChange={(e) => setFilter(e.target.value)}
                    />
                </div>

                <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar snap-x">
                    {/* Filtro Estado */}
                    <div className="relative min-w-[150px] snap-start">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ec4899]" size={14} />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:bg-white focus:border-[#ec4899] appearance-none cursor-pointer transition-all">
                            <option value="all">Estado (Todos)</option>
                            <option value="pendiente">Solo Pendientes</option>
                            <option value="vendido">Solo Vendidos</option>
                            <option value="anulado">Solo Anulados</option>
                        </select>
                    </div>

                    {/* Filtro Método de Pago */}
                    <div className="relative min-w-[150px] snap-start">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={14} />
                        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:bg-white focus:border-[#3b82f6] appearance-none cursor-pointer transition-all">
                            <option value="all">Pagos (Todos)</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta (POS)</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="yape">Yape / Plin</option>
                        </select>
                    </div>

                    {/* Filtro Logística */}
                    <div className="relative min-w-[150px] snap-start">
                        <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                        <select value={logisticFilter} onChange={(e) => setLogisticFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:bg-white focus:border-emerald-500 appearance-none cursor-pointer transition-all">
                            <option value="all">Logística (Todas)</option>
                            <option value="shipping">Solo Envíos</option>
                            <option value="pickup">Solo Recojo Tienda</option>
                        </select>
                    </div>

                    {/* Filtro Fecha */}
                    <div className="relative min-w-[150px] snap-start">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={14} />
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:bg-white focus:border-amber-500 appearance-none cursor-pointer transition-all">
                            <option value="all">Fecha (Cualquiera)</option>
                            <option value="today">Ventas de Hoy</option>
                            <option value="week">Esta Semana</option>
                            <option value="month">Este Mes</option>
                            <option value="exact">Fecha Exacta...</option>
                        </select>
                    </div>
                </div>

                {(statusFilter !== 'all' || logisticFilter !== 'all' || paymentFilter !== 'all' || dateFilter !== 'all' || filter) && (
                    <button onClick={() => { setStatusFilter('all'); setLogisticFilter('all'); setPaymentFilter('all'); setDateFilter('all'); setExactDate(''); setFilter(''); }} className="hidden sm:block p-3.5 text-slate-400 hover:text-red-500 bg-[#f4f6f9] hover:bg-red-50 rounded-2xl transition-colors shrink-0"><X size={18} /></button>
                )}
            </div>

            {/* TABLA OPTIMIZADA (HÍBRIDA: CARDS MÓVIL / TABLA DESKTOP) */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">

                {loading && pedidos.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <Loader2 className="animate-spin text-[#3b82f6]" size={32} />
                        <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Cargando bóveda de ventas...</p>
                    </div>
                ) : pedidos.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-300">
                        <Store size={56} className="mb-4 opacity-30 text-[#1e2a4a]" />
                        <p className="font-bold text-[#1e2a4a]">No se encontraron tickets</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">Intenta ajustar los filtros de búsqueda.</p>
                    </div>
                ) : (
                    <>
                        {/* === VISTA MÓVIL: TARJETAS (Oculto en Desktop) === */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {pedidos.map((p) => (
                                <div key={p.id} id={`row-mobile-${p.id}`} className={`p-5 flex flex-col gap-3 ${p.estado === 'anulado' ? 'opacity-60 bg-slate-50' : 'bg-white'}`}>

                                    {/* Top: Ticket & Estado */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-black text-[#3b82f6] text-sm">#{p.ticket}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{new Date(p.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <StatusBadge status={p.estado} />
                                    </div>

                                    {/* Middle: Origen & Cliente */}
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="text-sm font-bold text-[#1e2a4a] truncate max-w-[60%]">{p.cliente_nombre}</div>
                                        <div className="shrink-0">
                                            {p.turno_id ? (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest"><Store size={10} /> Tienda</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest"><Globe size={10} /> Web</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info Logística y Pago */}
                                    <div className="flex justify-between items-center bg-[#f4f6f9]/50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex flex-col gap-1">
                                            {p.metodo_entrega === 'pickup' ? (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#ec4899] uppercase"><Store size={12} /> Recojo</div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 uppercase"><Truck size={12} /> Envío</div>
                                            )}
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest"><CreditCard size={10} className="inline mr-1" />{p.metodo_pago}</div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Total</span>
                                            <span className="font-black text-[#1e2a4a] text-lg">S/ {p.total?.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Bottom: Acciones */}
                                    <div className="flex justify-between items-center gap-2 mt-1">
                                        <button onClick={() => openDetails(p)} className="flex-1 py-2.5 text-slate-500 hover:text-[#ec4899] bg-slate-50 hover:bg-[#ec4899]/10 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5">
                                            <Eye size={14} /> Detalles
                                        </button>

                                        {p.estado === 'vendido' && (
                                            <button onClick={() => printThermalTicket(p)} className="flex-1 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5">
                                                <Printer size={14} /> Ticket
                                            </button>
                                        )}

                                        {p.estado !== 'vendido' && p.estado !== 'anulado' && (
                                            <button onClick={() => handleOpenPayment(p)} className="flex-[1.5] bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-sm">
                                                <Wallet size={14} /> Cobrar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* === VISTA DESKTOP: TABLA CLÁSICA (Oculto en Móvil) === */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[1000px]">
                                <thead>
                                    <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                        <th className="p-5">Ticket / Origen</th>
                                        <th className="p-5">Cliente</th>
                                        <th className="p-5">Logística</th>
                                        <th className="p-5">Monto</th>
                                        <th className="p-5 text-center">Estado Financiero</th>
                                        <th className="p-5 text-right">Acciones de Venta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {pedidos.map((p) => (
                                        <tr key={p.id} id={`row-${p.id}`} className={`hover:bg-slate-50/80 transition-colors bg-white group ${p.estado === 'anulado' ? 'opacity-60' : ''}`}>
                                            <td className="p-5">
                                                <div className="font-black text-[#3b82f6] text-sm">#{p.ticket}</div>
                                                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(p.created_at).toLocaleString('es-PE')}</div>
                                                <div className="mt-2">
                                                    {p.turno_id ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest"><Store size={10} /> POS Tienda</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest"><Globe size={10} /> Web Online</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-5">
                                                <div className="text-sm font-bold text-[#1e2a4a] line-clamp-1">{p.cliente_nombre}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">Doc: <span className="font-bold text-slate-600">{p.cliente_dni_ruc || 'N/A'}</span></div>
                                            </td>

                                            <td className="p-5">
                                                {p.metodo_entrega === 'pickup' ? (
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#ec4899] uppercase"><Store size={14} /> Recojo Tienda</div>
                                                ) : (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-500 uppercase"><Truck size={14} /> Envío</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1 line-clamp-1">Vía: {p.agencia}</div>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-5">
                                                <div className="text-base font-black text-[#1e2a4a]">S/ {p.total?.toFixed(2)}</div>
                                                <div className="text-[10px] font-bold text-[#3b82f6] mt-0.5 uppercase tracking-widest">{p.metodo_pago}</div>
                                            </td>

                                            <td className="p-5 text-center"><StatusBadge status={p.estado} /></td>

                                            <td className="p-5">
                                                <div className="flex justify-end items-center gap-2">
                                                    {p.estado !== 'vendido' && p.estado !== 'anulado' && (
                                                        <button onClick={() => handleOpenPayment(p)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm">
                                                            <Wallet size={14} /> Cobrar
                                                        </button>
                                                    )}
                                                    {p.estado === 'vendido' && (
                                                        <>
                                                            <button onClick={() => generateIndividualPDF(p)} className="p-2.5 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 rounded-xl transition-all shadow-sm" title="Descargar PDF A4"><FileText size={16} /></button>
                                                            <button onClick={() => printThermalTicket(p)} className="p-2.5 text-slate-700 hover:text-white bg-slate-100 hover:bg-[#1e2a4a] border border-slate-200 hover:border-transparent rounded-xl transition-all shadow-sm" title="Reimprimir Ticket (80mm)"><Printer size={16} /></button>
                                                        </>
                                                    )}
                                                    <button onClick={() => openDetails(p)} className="p-2.5 text-slate-500 hover:text-[#ec4899] bg-white border border-slate-200 hover:border-[#ec4899] hover:bg-[#ec4899]/5 rounded-xl transition-all shadow-sm" title="Auditar Ticket"><Eye size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* BOTÓN CARGAR MÁS (Ambas vistas) */}
                {/* BOTÓN CARGAR MÁS (Solo aparece si realmente hay más datos que traer) */}
                {!loading && hasMore && pedidos.length > 0 && (
                    <div className="p-6 border-t border-slate-100 flex justify-center bg-[#f4f6f9]/30">
                        <button
                            onClick={() => fetchPedidos(false)}
                            disabled={loadingMore}
                            className="group flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-[#3b82f6] px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-[#1e2a4a] hover:text-[#3b82f6] transition-all shadow-sm hover:shadow-md w-full sm:w-auto active:scale-95"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>Buscando registros...</span>
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
                                    <span>Mostrar ventas anteriores</span>
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* INDICADOR DE FINAL DE LISTA (Opcional, para que el usuario sepa que ya cargó todo) */}
                {!hasMore && pedidos.length > 0 && !loading && (
                    <div className="p-8 text-center bg-[#f4f6f9]/10 border-t border-slate-50">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                            — Has llegado al final del historial —
                        </p>
                    </div>
                )}
            </div>

            {/* MODALES DE PAGO Y DETALLE */}
            {isPaymentModalOpen && orderToSell && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in duration-300">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><Wallet size={28} /></div>
                            <h3 className="text-2xl font-black text-[#1e2a4a] tracking-tight">Cobrar Ticket #{orderToSell.ticket}</h3>
                            <p className="text-slate-500 text-xs sm:text-sm mt-2">Registra el ingreso del dinero para actualizar la caja y el Kardex.</p>
                        </div>

                        <div className="space-y-3">
                            <button onClick={() => ejecutarActualizacionVendido(orderToSell, 'efectivo')} disabled={!activeShift || isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-transparent bg-[#f4f6f9] hover:bg-emerald-50 hover:border-emerald-500 rounded-2xl transition-all text-left group disabled:opacity-50">
                                <div className="p-3 bg-white shadow-sm rounded-xl text-emerald-500"><Wallet size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a]">Efectivo (Caja Física)</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Suma al Arqueo Diario</p>
                                    {!activeShift && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Abre tu caja (POS) primero.</p>}
                                </div>
                            </button>

                            <button onClick={() => ejecutarActualizacionVendido(orderToSell, 'yape_pos')} disabled={!activeShift || isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-transparent bg-[#f4f6f9] hover:bg-purple-50 hover:border-purple-500 rounded-2xl transition-all text-left group disabled:opacity-50">
                                <div className="p-3 bg-white shadow-sm rounded-xl text-purple-500"><Store size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a]">Yape / POS Tienda</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Dinero Digital</p>
                                    {!activeShift && <p className="text-[10px] text-red-500 font-bold mt-1">⚠️ Abre tu caja (POS) primero.</p>}
                                </div>
                            </button>

                            <button onClick={() => ejecutarActualizacionVendido(orderToSell, 'banco')} disabled={isProcessingSale} className="w-full flex items-center gap-4 p-4 border-2 border-transparent bg-[#f4f6f9] hover:bg-blue-50 hover:border-[#3b82f6] rounded-2xl transition-all text-left group disabled:opacity-50">
                                <div className="p-3 bg-white shadow-sm rounded-xl text-[#3b82f6]"><Globe size={24} /></div>
                                <div>
                                    <h4 className="font-bold text-[#1e2a4a]">Transferencia Bancaria</h4>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Directo a cuenta empresa</p>
                                </div>
                            </button>
                        </div>

                        <button onClick={() => setIsPaymentModalOpen(false)} className="w-full mt-6 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-[#ec4899] bg-slate-50 sm:bg-white rounded-2xl transition-colors">Cancelar</button>
                    </div>
                </div>
            )}

            {/* MODAL DETALLES */}
            {isDetailsOpen && selectedOrder && (
                <div ref={overlayRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
                    <div ref={modalRef} className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>

                        <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/50">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] flex items-center gap-3">#{selectedOrder.ticket} <StatusBadge status={selectedOrder.estado} /></h3>
                                <p className="text-[10px] sm:text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">{new Date(selectedOrder.created_at).toLocaleString('es-PE')}</p>
                            </div>
                            <button onClick={closeDetails} className="p-2 text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 rounded-full transition-colors hidden sm:block"><X size={20} /></button>
                        </div>

                        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white hide-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-[#f4f6f9] p-5 rounded-2xl">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2"><User size={14} className="text-[#3b82f6]" /> Cliente</h4>
                                    <p className="text-sm font-bold text-[#1e2a4a]">{selectedOrder.cliente_nombre}</p>
                                    <p className="text-xs text-slate-500 font-bold mt-1">DNI/RUC: {selectedOrder.cliente_dni_ruc || 'N/A'}</p>
                                </div>
                                <div className="bg-[#f4f6f9] p-5 rounded-2xl">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2"><Truck size={14} className="text-emerald-500" /> Logística y Pago</h4>
                                    <p className="text-sm font-bold text-[#1e2a4a] uppercase">{selectedOrder.metodo_entrega === 'pickup' ? 'Recojo Tienda' : 'Envío'}</p>
                                    <p className="text-xs text-[#ec4899] font-black mt-1 uppercase">Pago: {selectedOrder.metodo_pago}</p>
                                </div>
                            </div>

                            {selectedOrder.metodo_entrega === 'shipping' && (
                                <div className="bg-[#f4f6f9] p-5 rounded-2xl">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2"><MapPin size={14} className="text-amber-500" /> Dirección de Envío</h4>
                                    <p className="text-sm font-bold text-[#1e2a4a]">{selectedOrder.direccion}</p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2"><Package size={14} className="text-purple-500" /> Detalle de Productos</h4>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-[#f4f6f9]/80 text-slate-500 text-[10px] uppercase font-black border-b border-slate-100"><tr><th className="p-4">Producto</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Subtotal</th></tr></thead>
                                        <tbody className="divide-y divide-slate-50 bg-white">
                                            {selectedOrder.items && selectedOrder.items.map((item, index) => (
                                                <tr key={index} className="hover:bg-slate-50/50 transition-colors"><td className="p-4 font-bold text-[#1e2a4a]">{item.product.name}</td><td className="p-4 text-center font-bold text-[#3b82f6]">{item.quantity}</td><td className="p-4 text-right font-black text-[#1e2a4a]">S/ {(item.product.price * item.quantity).toFixed(2)}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 sm:p-8 border-t border-slate-100 bg-[#f4f6f9]/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                            {(role === 'admin' || role === 'supervisor') && selectedOrder.estado !== 'anulado' && (
                                <button onClick={() => procesarAnulacion(selectedOrder)} disabled={isAnuling} className="w-full sm:w-auto text-red-500 hover:text-white border-2 border-red-200 hover:bg-red-500 hover:border-transparent px-5 py-3.5 sm:py-3 rounded-2xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2">
                                    {isAnuling ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={16} />} Anular Venta
                                </button>
                            )}
                            <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:ml-auto bg-white px-5 py-4 sm:py-3 rounded-2xl shadow-sm border border-slate-100">
                                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total</span>
                                <span className="text-2xl font-black text-[#1e2a4a] tracking-tight">S/ {selectedOrder.total?.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    if (status === 'pendiente') return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><Clock size={10} /> Por Cobrar</span>;
    if (status === 'vendido') return <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><CheckCircle2 size={10} /> Vendido</span>;
    if (status === 'anulado') return <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><XCircle size={10} /> Anulado</span>;
    return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">{status}</span>;
}