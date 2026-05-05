import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    ShoppingCart, Plus, Search, CheckCircle2,
    X, Loader2, Package, Truck, FileText, ArrowRight, DollarSign, Building2, PackageOpen, Clock, XCircle, CreditCard, Calendar, FileSpreadsheet
} from 'lucide-react';
import { exportarComprasExcel } from '../utils/excelGenerator';
import gsap from 'gsap';
import { useChanellUI } from '../context/UIContext';

export default function ComprasAdmin() {
    const { notify, confirm } = useChanellUI();
    const { role } = useAuth();
    const [ordenes, setOrdenes] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- NUEVOS FILTROS DE AUDITORÍA ---
    const [searchOrden, setSearchOrden] = useState('');
    const [logisticaFilter, setLogisticaFilter] = useState('all');
    const [pagoFilter, setPagoFilter] = useState('all');
    const [proveedorFilter, setProveedorFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    // Estados del Modal de Nueva Orden
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedProveedor, setSelectedProveedor] = useState('');
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: dataOrdenes } = await supabase.from('ordenes_compra').select(`*, proveedores:proveedor_id(razon_social)`).order('created_at', { ascending: false });
        const { data: dataProv } = await supabase.from('proveedores').select('*').eq('activo', true);
        const { data: dataProd } = await supabase.from('productos').select('*').order('name', { ascending: true });

        if (dataOrdenes) setOrdenes(dataOrdenes);
        if (dataProv) setProveedores(dataProv);
        if (dataProd) setProductos(dataProd);
        setLoading(false);
    };

    const handleMarcarPagado = async (compra) => {
        const isConfirmed = await confirm("Pagar Deuda", `¿Confirmas que ya transferiste / pagaste S/ ${compra.total_estimado.toFixed(2)} al proveedor?`, true);
        if (!isConfirmed) return;
        try {
            setLoading(true);
            const { error } = await supabase.from('ordenes_compra').update({ estado_pago: 'pagado', monto_pagado: compra.total_estimado }).eq('id', compra.id);
            if (error) throw error;
            fetchData();
            notify("Pago registrado correctamente. Deuda saldada.", "success");
        } catch (error) {
            notify("Error al registrar pago: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DEL CARRITO ---
    const addToCart = (producto) => {
        if (cart.find(item => item.producto.id === producto.id)) return;
        setCart([...cart, { producto, cantidad: 1, costo: producto.costo || 0 }]);
        setSearchTerm('');
    };
    const removeFromCart = (productoId) => setCart(cart.filter(item => item.producto.id !== productoId));
    const updateItem = (productoId, field, value) => {
        const numValue = parseFloat(value) || 0;
        setCart(cart.map(item => item.producto.id === productoId ? { ...item, [field]: numValue } : item));
    };

    const totalOrden = cart.reduce((acc, item) => acc + (item.cantidad * item.costo), 0);
    const filteredProductos = productos.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleCrearOrden = async (e) => {
        e.preventDefault();
        if (!selectedProveedor) return notify("Selecciona un proveedor", "warning");
        if (cart.length === 0) return notify("Agrega al menos un producto", "warning");

        setIsSaving(true);
        try {
            const numeroOrden = `PO-${Math.floor(Date.now() / 1000)}`;
            const { data: ordenData, error: ordenError } = await supabase.from('ordenes_compra').insert([{
                numero_orden: numeroOrden, proveedor_id: selectedProveedor, total_estimado: totalOrden, estado: 'Borrador', estado_pago: 'pendiente'
            }]).select().single();
            if (ordenError) throw ordenError;

            const detalles = cart.map(item => ({ orden_id: ordenData.id, producto_id: item.producto.id, cantidad: item.cantidad, costo_unitario: item.costo }));
            const { error: detallesError } = await supabase.from('ordenes_compra_detalle').insert(detalles);
            if (detallesError) throw detallesError;

            setIsModalOpen(false); setCart([]); setSelectedProveedor(''); fetchData();
            notify(`Orden ${numeroOrden} creada con éxito.`, "success");
        } catch (error) {
            notify("Error al crear orden: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRecibirOrden = async (ordenId) => {
        const isConfirmed = await confirm("Recibir Orden", "¿Confirmas que la mercadería llegó? Esto actualizará tu stock irreversiblemente.", true);
        if (!isConfirmed) return;
        try {
            setLoading(true);
            const { error } = await supabase.rpc('recibir_orden_compra', { p_orden_id: ordenId });
            if (error) throw new Error(error.message);
            fetchData();
            notify("Mercadería recibida exitosamente.", "success");
        } catch (error) {
            notify("Error: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAnularOrden = async (ordenId) => {
        const isConfirmed = await confirm("Anular Borrador", "¿Seguro que deseas anular este borrador?", true);
        if (!isConfirmed) return;
        try {
            setLoading(true);
            await supabase.from('ordenes_compra').update({ estado: 'Anulada' }).eq('id', ordenId);
            fetchData();
            notify("Borrador anulado.", "success");
        } catch (error) {
            notify("Error: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    // --- APLICACIÓN DE SÚPER FILTROS ---
    const filteredOrdenes = ordenes.filter(c => {
        const search = searchOrden.toLowerCase();
        const matchesSearch = (c.proveedores?.razon_social || '').toLowerCase().includes(search) || c.numero_orden?.toLowerCase().includes(search);

        const matchesLogistica = logisticaFilter === 'all' || c.estado?.toLowerCase() === logisticaFilter.toLowerCase();
        const estadoPagoReal = c.estado_pago || 'pendiente';
        const matchesPago = pagoFilter === 'all' || estadoPagoReal === pagoFilter;
        const matchesProv = proveedorFilter === 'all' || c.proveedor_id === proveedorFilter;

        let matchesDate = true;
        if (dateFilter !== 'all') {
            const date = new Date(c.created_at);
            const today = new Date();
            if (dateFilter === 'today') {
                matchesDate = date.toDateString() === today.toDateString();
            } else if (dateFilter === 'month') {
                matchesDate = date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            }
        }

        return matchesSearch && matchesLogistica && matchesPago && matchesProv && matchesDate;
    });

    // --- KPI UX: CÁLCULO DE DEUDA TOTAL ---
    const deudaTotal = useMemo(() => {
        return filteredOrdenes
            .filter(o => (o.estado_pago || 'pendiente') !== 'pagado' && o.estado !== 'Anulada')
            .reduce((sum, o) => sum + (o.total_estimado || 0), 0);
    }, [filteredOrdenes]);

    const handleExport = () => {
        if (filteredOrdenes.length === 0) return notify("No hay datos para exportar", "info");
        notify("Generando Excel de compras...", "info");
        exportarComprasExcel(filteredOrdenes);
    };

    return (
        <div className="w-full space-y-6 pb-10">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <ShoppingCart className="text-[#3b82f6]" size={32} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Abastecimiento</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Genera órdenes de compra, recibe stock y salda cuentas por pagar.</p>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    {(role === 'admin' || role === 'supervisor') && (
                        <button onClick={handleExport} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    )}
                    {(role === 'admin' || role === 'supervisor') && (
                        <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none bg-[#3b82f6] hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(59,130,246,0.3)] transition-all hover:-translate-y-0.5">
                            <Plus size={18} /> Nueva Orden
                        </button>
                    )}
                </div>
            </div>

            {/* WIDGET UX: DEUDA TOTAL */}
            <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center"><DollarSign size={28} /></div>
                    <div>
                        <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase mb-1">Deuda Total Pendiente (Por Pagar)</p>
                        <h3 className="text-3xl font-black text-[#1e2a4a]">S/ {deudaTotal.toFixed(2)}</h3>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS AVANZADA */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col md:flex-row items-center gap-3">
                <div className="relative w-full md:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar código OC..." className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-[#3b82f6] text-[#1e2a4a] transition-all" value={searchOrden} onChange={(e) => setSearchOrden(e.target.value)} />
                </div>

                <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="relative min-w-[160px]">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <select value={proveedorFilter} onChange={(e) => setProveedorFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-slate-500 appearance-none max-w-[180px] truncate transition-all cursor-pointer">
                            <option value="all">Proveedor (Todos)</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <PackageOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={14} />
                        <select value={logisticaFilter} onChange={(e) => setLogisticaFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-[#3b82f6] appearance-none transition-all cursor-pointer">
                            <option value="all">Logística (Todas)</option>
                            <option value="borrador">En Camino</option>
                            <option value="recibida">En Almacén</option>
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                        <select value={pagoFilter} onChange={(e) => setPagoFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-emerald-500 appearance-none transition-all cursor-pointer">
                            <option value="all">Finanzas (Todas)</option>
                            <option value="pendiente">Deuda (Pendiente)</option>
                            <option value="pagado">Ya Pagado</option>
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-slate-500 appearance-none transition-all cursor-pointer">
                            <option value="all">Fecha (Todas)</option>
                            <option value="today">Hoy</option>
                            <option value="month">Este Mes</option>
                        </select>
                    </div>
                </div>

                {(searchOrden || logisticaFilter !== 'all' || pagoFilter !== 'all' || proveedorFilter !== 'all' || dateFilter !== 'all') && (
                    <button onClick={() => { setSearchOrden(''); setLogisticaFilter('all'); setPagoFilter('all'); setProveedorFilter('all'); setDateFilter('all'); }} className="p-3.5 text-slate-400 hover:text-red-500 bg-[#f4f6f9] hover:bg-red-50 rounded-2xl transition-colors"><X size={18} /></button>
                )}
            </div>

            {/* TABLA PRINCIPAL */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                <th className="p-5">Orden / Fecha</th>
                                <th className="p-5">Proveedor</th>
                                <th className="p-5 text-center bg-blue-50/50 border-l border-r border-slate-100">Logística (Kardex)</th>
                                <th className="p-5 text-center bg-emerald-50/50 border-r border-slate-100">Finanzas (Deuda)</th>
                                <th className="p-5 text-right">Total Invertido</th>
                                <th className="p-5 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && ordenes.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-[#3b82f6] mb-2" /> Cargando...</td></tr>
                            ) : filteredOrdenes.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400">No hay órdenes registradas.</td></tr>
                            ) : (
                                filteredOrdenes.map((orden) => (
                                    <tr key={orden.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-black text-[#3b82f6] text-sm">{orden.numero_orden}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(orden.created_at).toLocaleDateString()}</div>
                                        </td>

                                        <td className="p-5">
                                            <div className="text-sm font-bold text-[#1e2a4a] flex items-center gap-2"><Building2 size={14} className="text-[#ec4899] shrink-0" /> {orden.proveedores?.razon_social || 'Desconocido'}</div>
                                        </td>

                                        <td className="p-5 text-center border-l border-r border-slate-50 bg-blue-50/10">
                                            {orden.estado === 'Recibida' ? (
                                                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><PackageOpen size={14} /> En Almacén</span>
                                            ) : orden.estado === 'Anulada' ? (
                                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-400 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><XCircle size={14} /> Cancelada</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Clock size={14} /> En Camino</span>
                                            )}
                                        </td>

                                        <td className="p-5 text-center border-r border-slate-50 bg-emerald-50/10">
                                            {(orden.estado_pago || 'pendiente') === 'pagado' ? (
                                                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14} /> Pagado</span>
                                            ) : orden.estado === 'Anulada' ? (
                                                <span className="inline-flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">- - -</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"><Clock size={14} /> Por Pagar</span>
                                            )}
                                        </td>

                                        <td className="p-5 text-right font-black text-[#1e2a4a]">S/ {orden.total_estimado?.toFixed(2)}</td>

                                        <td className="p-5 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                {orden.estado === 'Borrador' && (
                                                    <>
                                                        <button onClick={() => handleRecibirOrden(orden.id)} className="bg-[#3b82f6] hover:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm" title="Confirmar recepción en almacén">
                                                            <Truck size={14} /> Recibir
                                                        </button>
                                                        <button onClick={() => handleAnularOrden(orden.id)} className="bg-red-50 hover:bg-red-100 text-red-500 px-3 py-2.5 rounded-xl flex items-center gap-1 transition-colors"><X size={14} /></button>
                                                    </>
                                                )}

                                                {orden.estado === 'Recibida' && (orden.estado_pago || 'pendiente') !== 'pagado' && (role === 'admin' || role === 'supervisor') && (
                                                    <button onClick={() => handleMarcarPagado(orden)} className="px-3 py-2.5 text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5">
                                                        <CreditCard size={14} /> Pagar Deuda
                                                    </button>
                                                )}

                                                {orden.estado === 'Recibida' && (orden.estado_pago || 'pendiente') === 'pagado' && (
                                                    <span className="text-emerald-500 flex items-center justify-center gap-1 text-xs font-bold"><CheckCircle2 size={16} /> CERRADO</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL NUEVA ORDEN DE COMPRA */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/50">
                            <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-3">
                                <div className="p-2 bg-[#3b82f6]/10 text-[#3b82f6] rounded-xl"><FileText size={24} /></div>
                                Nueva Orden de Compra
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col lg:flex-row gap-6 bg-white">
                            <div className="w-full lg:w-1/3 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Proveedor</label>
                                    <select value={selectedProveedor} onChange={(e) => setSelectedProveedor(e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all cursor-pointer">
                                        <option value="">Seleccione un proveedor...</option>
                                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Buscar Producto</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={16} />
                                        <input type="text" placeholder="Ej. Audífonos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all" />
                                    </div>
                                    {searchTerm && (
                                        <div className="mt-2 border border-slate-100 rounded-2xl max-h-48 overflow-y-auto shadow-lg shadow-slate-200/50 bg-white z-10 relative">
                                            {filteredProductos.length === 0 ? <div className="p-4 text-sm text-slate-400 text-center font-medium">No encontrado</div> :
                                                filteredProductos.map(prod => (
                                                    <button key={prod.id} onClick={() => addToCart(prod)} className="w-full text-left p-4 text-sm hover:bg-[#f4f6f9] border-b border-slate-50 flex justify-between items-center group transition-colors">
                                                        <span className="truncate pr-2 font-bold text-[#1e2a4a]">{prod.name}</span><Plus size={18} className="text-[#ec4899] transition-opacity" />
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-full lg:w-2/3 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/30">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Detalle de Productos</span>
                                    <span className="bg-[#3b82f6]/10 text-[#3b82f6] px-3 py-1 rounded-lg text-xs font-black">{cart.length} ítems</span>
                                </div>
                                <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[200px] bg-slate-50/30">
                                    {cart.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70"><Package size={48} className="mb-3 text-slate-300" /><p className="font-bold text-sm">No hay productos en la orden</p></div>
                                    ) : (
                                        cart.map(item => (
                                            <div key={item.producto.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-slate-200 transition-colors">
                                                <button onClick={() => removeFromCart(item.producto.id)} className="text-slate-400 hover:text-red-500 bg-[#f4f6f9] hover:bg-red-50 p-2 rounded-xl transition-colors"><X size={16} /></button>
                                                <div className="flex-1 min-w-0"><p className="text-sm font-black text-[#1e2a4a] truncate">{item.producto.name}</p><p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Stock actual: {item.producto.stock}</p></div>
                                                <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                                    <div className="flex flex-col w-20"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest">Cant.</label><input type="number" min="1" value={item.cantidad} onChange={(e) => updateItem(item.producto.id, 'cantidad', e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-xl p-2.5 text-sm font-bold text-center text-[#1e2a4a] outline-none focus:bg-white focus:border-[#3b82f6] transition-all" /></div>
                                                    <div className="flex flex-col w-24"><label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-widest flex items-center gap-1"><DollarSign size={10} /> Costo Un.</label><input type="number" min="0" step="0.01" value={item.costo} onChange={(e) => updateItem(item.producto.id, 'costo', e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-xl p-2.5 text-sm font-bold text-right text-[#1e2a4a] outline-none focus:bg-white focus:border-[#3b82f6] transition-all" /></div>
                                                    <div className="w-28 sm:min-w-[120px] text-right pt-5 shrink-0"><span className="font-black text-[#3b82f6] text-sm sm:text-base">S/ {(item.cantidad * item.costo).toFixed(2)}</span></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-5 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div><span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total Estimado</span><span className="text-3xl font-black text-[#1e2a4a]">S/ {totalOrden.toFixed(2)}</span></div>
                                    <button onClick={handleCrearOrden} disabled={isSaving || cart.length === 0} className="w-full sm:w-auto bg-[#3b82f6] hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 text-xs">
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Orden'} <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}