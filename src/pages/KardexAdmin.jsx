import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Package, Search, Plus, X, ArrowUpRight, ArrowDownRight, RefreshCw, Filter, Calendar, Tag, AlertCircle, Save, Loader2, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { exportarKardexExcel } from '../utils/excelGenerator';
import gsap from 'gsap';
import { useChanellUI } from '../context/UIContext';

export default function KardexAdmin() {
    const { notify } = useChanellUI();
    const { user, role } = useAuth();
    const [movimientos, setMovimientos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // --- ESTADOS DE PAGINACIÓN ---
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEM_PER_PAGE = 50;

    // --- NUEVOS FILTROS ---
    const [filterText, setFilterText] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [productFilter, setProductFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [exactDate, setExactDate] = useState('');

    // --- MODAL DE REGISTRO (SIN DATA BASURA) ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [movType, setMovType] = useState('entrada');
    const [cantidad, setCantidad] = useState('');
    const [motivoCategoria, setMotivoCategoria] = useState('');
    const [motivoNotas, setMotivoNotas] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchProductos();
    }, []);

    const fetchProductos = async () => {
        const { data } = await supabase.from('productos').select('id, name, stock').order('name', { ascending: true });
        if (data) setProductos(data);
    };

    // =========================================================================
    // LÓGICA DE CARGA CON SÚPER FILTROS
    // =========================================================================
    const fetchData = async (reset = false) => {
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
            .from('movimientos_inventario')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (typeFilter !== 'all') query = query.eq('tipo_movimiento', typeFilter);
        if (productFilter !== 'all') query = query.eq('producto_id', productFilter);

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

        if (filterText) query = query.or(`producto_nombre.ilike.%${filterText}%,motivo.ilike.%${filterText}%`);

        const { data, error, count } = await query;

        if (!error && data) {
            setMovimientos(prev => reset ? data : [...prev, ...data]);
            setHasMore(from + data.length < count);
            if (!reset) setPage(currentPage);
        }

        setLoading(false);
        setLoadingMore(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(true);
        }, 400);
        return () => clearTimeout(timer);
    }, [filterText, typeFilter, productFilter, dateFilter, exactDate]);


    // =========================================================================
    // EXPORTAR KARDEX A EXCEL
    // =========================================================================
    const handleExportExcel = async () => {
        notify("Generando archivo Excel de Auditoría...", "info");
        let query = supabase.from('movimientos_inventario').select('*').order('created_at', { ascending: false });

        if (typeFilter !== 'all') query = query.eq('tipo_movimiento', typeFilter);
        if (productFilter !== 'all') query = query.eq('producto_id', productFilter);

        // Misma lógica de fechas para la exportación total
        if (dateFilter !== 'all') {
            const today = new Date();
            if (dateFilter === 'today') query = query.gte('created_at', new Date(today.setHours(0, 0, 0, 0)).toISOString());
            else if (dateFilter === 'month') query = query.gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString());
        }

        const { data, error } = await query;
        if (error || !data) return notify("Error al exportar el Kardex.", "error");

        exportarKardexExcel(data);
    };


    const handleRegistrarMovimiento = async (e) => {
        e.preventDefault();
        if (!selectedProduct || cantidad === '' || !motivoCategoria) return;

        setIsSaving(true);
        try {
            const prod = productos.find(p => p.id === selectedProduct);
            const stockAnterior = prod.stock || 0;
            const cantInput = parseInt(cantidad);

            if (cantInput < 0) throw new Error("La cantidad no puede ser negativa.");

            let stockNuevo = stockAnterior;
            let cantidadMovimiento = cantInput;

            if (movType === 'entrada') {
                stockNuevo = stockAnterior + cantInput;
            } else if (movType === 'salida') {
                if (stockAnterior < cantInput) throw new Error("No hay suficiente stock para hacer esta salida.");
                stockNuevo = stockAnterior - cantInput;
                cantidadMovimiento = -cantInput;
            } else if (movType === 'ajuste') {
                stockNuevo = cantInput;
                cantidadMovimiento = cantInput - stockAnterior;
            }

            const { error: prodError } = await supabase.from('productos').update({ stock: stockNuevo }).eq('id', prod.id);
            if (prodError) throw prodError;

            const nombreUsuario = user?.user_metadata?.full_name || user?.email || 'Admin';

            // Construimos el motivo oficial y limpio
            const motivoFinal = motivoNotas ? `${motivoCategoria} - ${motivoNotas}` : motivoCategoria;

            const { error: movError } = await supabase.from('movimientos_inventario').insert({
                producto_id: prod.id,
                producto_nombre: prod.name,
                tipo_movimiento: movType,
                cantidad: cantidadMovimiento,
                stock_anterior: stockAnterior,
                stock_nuevo: stockNuevo,
                motivo: motivoFinal,
                usuario_id: user.id,
                usuario_nombre: nombreUsuario
            });

            if (movError) throw movError;

            await fetchProductos();
            await fetchData(true);
            notify("Movimiento registrado exitosamente.", "success");

            setCantidad('');
            setMotivoCategoria('');
            setMotivoNotas('');
            setSelectedProduct('');
            setMovType('entrada');
            setIsModalOpen(false);

        } catch (error) {
            console.error(error);
            notify("Error: " + error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Opciones dinámicas para el select de motivos según el tipo de movimiento
    const getMotivoOptions = () => {
        if (movType === 'entrada') return ['Compra a Proveedor', 'Devolución de Cliente', 'Ajuste a Favor', 'Otro Ingreso'];
        if (movType === 'salida') return ['Venta Manual', 'Merma / Rotura', 'Uso Interno / Muestras', 'Ajuste en Contra', 'Otra Salida'];
        if (movType === 'ajuste') return ['Auditoría Física', 'Corrección de Sistema', 'Descuadre'];
        return [];
    };

    return (
        <div className="w-full space-y-6 pb-10">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Package className="text-[#3b82f6]" size={32} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Kardex de Inventario</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Auditoría estricta de entradas, salidas y ajustes de mercadería.</p>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    {(role === 'admin' || role === 'supervisor') && (
                        <button onClick={handleExportExcel} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    )}
                    <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none bg-[#3b82f6] hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
                        <Plus size={18} /> Registrar
                    </button>
                </div>
            </div>

            {/* Barra de Filtros Avanzada */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Buscar nota o referencia..." className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] rounded-2xl pl-12 pr-4 py-3 text-sm font-medium outline-none transition-all text-[#1e2a4a]" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
                </div>

                <div className="flex w-full md:w-auto gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="relative min-w-[180px]">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500" size={14} />
                        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-purple-500 appearance-none max-w-[200px] truncate transition-all cursor-pointer">
                            <option value="all">Producto (Todos)</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3b82f6]" size={14} />
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-[#3b82f6] appearance-none transition-all cursor-pointer">
                            <option value="all">Tipos (Todos)</option>
                            <option value="entrada">Entradas</option>
                            <option value="salida">Salidas</option>
                            <option value="ajuste">Ajustes</option>
                        </select>
                    </div>

                    <div className="relative min-w-[140px]">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ec4899]" size={14} />
                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent text-[#1e2a4a] text-xs font-bold rounded-2xl pl-10 pr-4 py-3 outline-none focus:bg-white focus:border-[#ec4899] appearance-none transition-all cursor-pointer">
                            <option value="all">Fecha (Todas)</option>
                            <option value="today">Hoy</option>
                            <option value="week">Esta Semana</option>
                            <option value="month">Este Mes</option>
                        </select>
                    </div>
                </div>

                {(typeFilter !== 'all' || productFilter !== 'all' || dateFilter !== 'all' || filterText) && (
                    <button onClick={() => { setTypeFilter('all'); setProductFilter('all'); setDateFilter('all'); setFilterText(''); }} className="p-3.5 text-slate-400 hover:text-[#ec4899] bg-[#f4f6f9] hover:bg-[#ec4899]/10 rounded-2xl transition-colors"><X size={18} /></button>
                )}
            </div>

            {/* Tabla de Movimientos */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead>
                            <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                <th className="p-5">Fecha y Hora</th>
                                <th className="p-5">Producto</th>
                                <th className="p-5 text-center">Tipo</th>
                                <th className="p-5 text-center">Cant.</th>
                                <th className="p-5 text-center">Stock Resultante</th>
                                <th className="p-5">Motivo / Ref.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && movimientos.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" />Cargando Kardex...</td></tr>
                            ) : movimientos.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-slate-400">No hay movimientos con los filtros actuales.</td></tr>
                            ) : (
                                movimientos.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="text-xs font-bold text-[#1e2a4a]">{new Date(m.created_at).toLocaleDateString('es-PE')}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">{new Date(m.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-sm font-bold text-[#3b82f6] line-clamp-1">{m.producto_nombre}</div>
                                            <div className="text-[9px] text-[#ec4899] font-bold uppercase tracking-widest mt-1">Resp: {m.usuario_nombre?.split('@')[0]}</div>
                                        </td>
                                        <td className="p-5 text-center"><MovTypeBadge type={m.tipo_movimiento} /></td>
                                        <td className="p-5 text-center">
                                            <span className={`font-black text-sm ${m.cantidad > 0 ? 'text-emerald-500' : m.cantidad < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                                {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="inline-flex items-center gap-2 bg-[#f4f6f9] border border-transparent px-3 py-1.5 rounded-xl">
                                                <span className="text-[10px] text-slate-400 line-through font-bold">{m.stock_anterior}</span>
                                                <span className="text-sm font-black text-[#1e2a4a]">➔ {m.stock_nuevo}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-xs font-bold text-slate-600 max-w-[250px] truncate" title={m.motivo}>{m.motivo}</div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {hasMore && (
                    <div className="p-4 border-t border-slate-100 flex justify-center bg-white">
                        <button onClick={() => fetchData(false)} disabled={loadingMore} className="flex items-center gap-2 bg-[#f4f6f9] hover:bg-slate-100 px-6 py-3 rounded-2xl text-xs font-bold text-[#1e2a4a] hover:text-[#3b82f6] transition-all">
                            {loadingMore ? <Loader2 className="animate-spin" size={14} /> : <ChevronDown size={14} />} Cargar anteriores
                        </button>
                    </div>
                )}
            </div>

            {/* MODAL REGISTRO DE MOVIMIENTO */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-100 bg-[#f4f6f9]/50">
                            <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-3">
                                <div className="p-2 bg-[#ec4899]/10 text-[#ec4899] rounded-xl"><RefreshCw size={24} /></div>
                                Ajuste de Inventario
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleRegistrarMovimiento} className="p-6 sm:p-8 space-y-5 overflow-y-auto bg-white">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Seleccionar Producto</label>
                                <select required value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all cursor-pointer">
                                    <option value="" disabled>-- Elige un producto --</option>
                                    {productos.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tipo de Operación</label>
                                    <select value={movType} onChange={(e) => { setMovType(e.target.value); setMotivoCategoria(''); }} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all cursor-pointer">
                                        <option value="entrada">Entrada (+)</option>
                                        <option value="salida">Salida (-)</option>
                                        <option value="ajuste">Ajuste Físico</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{movType === 'ajuste' ? 'Conteo Físico Real' : 'Cantidad'}</label>
                                    <input type="number" required min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-black text-center text-[#3b82f6] outline-none focus:bg-white focus:border-[#3b82f6] transition-all" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Motivo (Oficial)</label>
                                <select required value={motivoCategoria} onChange={(e) => setMotivoCategoria(e.target.value)} className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all cursor-pointer">
                                    <option value="" disabled>-- Selecciona un motivo --</option>
                                    {getMotivoOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Notas / Referencia (Opcional)</label>
                                <input type="text" value={motivoNotas} onChange={(e) => setMotivoNotas(e.target.value)} placeholder="Ej: Factura F001 / Autorizado por Juan" className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 text-sm font-medium text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all" />
                            </div>

                            <button type="submit" disabled={isSaving} className="w-full mt-8 bg-[#3b82f6] hover:bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} {isSaving ? 'Registrando...' : 'Confirmar Operación'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function MovTypeBadge({ type }) {
    if (type === 'entrada') return <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><ArrowUpRight size={12} /> Entrada</span>;
    if (type === 'salida') return <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><ArrowDownRight size={12} /> Salida</span>;
    if (type === 'ajuste') return <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest"><RefreshCw size={12} /> Ajuste</span>;
    return <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">{type}</span>;
}