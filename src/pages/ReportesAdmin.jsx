import { exportarVentasDiariasExcel, exportarRankingProductosExcel, exportarMetodosPagoExcel, exportarVendedorRankingExcel } from "../utils/excelGenerator";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Navigate } from 'react-router-dom';
import { Calendar, Download, BarChart3, Users, Package, CreditCard } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function ReportesAdmin() {
    const { role } = useAuth();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('ventas'); // ventas, vendedores, productos, pagos
    const [data, setData] = useState([]);

    // Filtros de fecha (Por defecto: Mes actual)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    useEffect(() => {
        if (role === 'admin') fetchReporte();
    }, [activeTab, startDate, endDate]);

    if (role !== 'admin') return <Navigate to="/admin/dashboard" replace />;

    const fetchReporte = async () => {
        setLoading(true);
        try {
            // Aseguramos que endDate cubra hasta las 23:59:59 del día seleccionado
            const startISO = new Date(`${startDate}T00:00:00.000Z`).toISOString();
            const endISO = new Date(`${endDate}T23:59:59.999Z`).toISOString();

            let rpcName = '';
            if (activeTab === 'ventas') rpcName = 'get_reporte_ventas_diarias';
            if (activeTab === 'vendedores') rpcName = 'get_reporte_por_vendedor';
            if (activeTab === 'productos') rpcName = 'get_reporte_por_producto';
            if (activeTab === 'pagos') rpcName = 'get_reporte_metodos_pago';

            const { data: result, error } = await supabase.rpc(rpcName, {
                p_start_date: startISO,
                p_end_date: endISO
            });

            if (error) throw error;
            setData(result || []);
        } catch (error) {
            console.error("Error al cargar reporte:", error);
        } finally {
            setLoading(false);
        }
    };

    // Función de exportación nativa
    const handleExportExcel = () => {
        if (!data || data.length === 0) return;

        const periodoTxt = `${startDate}_al_${endDate}`;

        if (activeTab === 'ventas') {
            exportarVentasDiariasExcel(data, periodoTxt);
        } else if (activeTab === 'productos') {
            exportarRankingProductosExcel(data, periodoTxt);
        } else if (activeTab === 'vendedores') {
            exportarVendedorRankingExcel(data, periodoTxt);
        } else if (activeTab === 'pagos') {
            exportarMetodosPagoExcel(data, periodoTxt);
        }
    };

    // Configuración de Pestañas
    const tabs = [
        { id: 'ventas', label: 'Ventas Diarias', icon: BarChart3 },
        { id: 'vendedores', label: 'Vendedores', icon: Users },
        { id: 'productos', label: 'Ranking Prod.', icon: Package },
        { id: 'pagos', label: 'Métodos Pago', icon: CreditCard },
    ];

    return (
        <div className="w-full space-y-4 sm:space-y-6 pb-20 sm:pb-10">
            {/* CABECERA Y FILTROS */}
            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="w-full xl:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <BarChart3 className="text-[#ec4899] shrink-0" size={28} />
                        <span className="text-[#1e2a4a]">Reportes Financieros</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-2">Análisis histórico profundo y exportación de datos.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-2 bg-[#f4f6f9] p-1.5 sm:p-2 rounded-2xl border border-slate-200 w-full sm:w-auto">
                        <Calendar size={18} className="text-slate-400 ml-2 shrink-0 hidden sm:block" />
                        <div className="flex w-full items-center justify-between sm:justify-start">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-xs sm:text-sm font-bold text-[#1e2a4a] outline-none flex-1 p-2 sm:p-0"
                            />
                            <span className="text-slate-300 font-black px-2">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-xs sm:text-sm font-bold text-[#1e2a4a] outline-none flex-1 p-2 sm:p-0 text-right sm:text-left"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleExportExcel}
                        disabled={data.length === 0}
                        className="w-full sm:w-auto bg-[#1e2a4a] hover:bg-black text-white px-6 py-3.5 sm:py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md"
                    >
                        <Download size={16} /> <span className="sm:hidden">Exportar</span> <span className="hidden sm:inline">Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* NAVEGACIÓN DE PESTAÑAS (Scroll Horizontal en Móvil) */}
            <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1 bg-slate-100/50 rounded-2xl border border-slate-200/60 snap-x">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all snap-start ${isActive ? 'bg-white text-[#3b82f6] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:bg-slate-200/50 hover:text-[#1e2a4a]'}`}
                        >
                            <Icon size={16} className={isActive ? 'text-[#ec4899]' : ''} /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ÁREA DE CONTENIDO */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden min-h-[400px] sm:min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-[400px] sm:h-[500px] text-slate-400 space-y-4">
                        <div className="w-8 h-8 border-4 border-[#ec4899] border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Procesando base de datos...</p>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-[400px] sm:h-[500px] text-slate-400 p-6 text-center">
                        <BarChart3 size={48} className="text-slate-200 mb-4" />
                        <p className="font-bold text-[#1e2a4a]">No hay registros para estas fechas.</p>
                        <p className="text-xs mt-1">Prueba ampliando el rango de búsqueda en el calendario superior.</p>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 lg:p-8">

                        {/* VISTA 1: VENTAS DIARIAS */}
                        {activeTab === 'ventas' && (
                            <div className="space-y-6 sm:space-y-8">
                                <div className="h-[250px] sm:h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                                <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} /><stop offset="95%" stopColor="#ec4899" stopOpacity={0} /></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} minTickGap={20} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} tickFormatter={(val) => `S/${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                                            <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} formatter={(val) => [`S/ ${Number(val).toFixed(2)}`]} />
                                            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIngresos)" />
                                            <Area type="monotone" dataKey="ganancia" name="Ganancia Neta" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <TablaGenerica data={data} columnas={['Fecha', 'N° Pedidos', 'Ingresos', 'Costos', 'Ganancia Neta']} keys={['fecha', 'num_pedidos', 'ingresos', 'costo_total', 'ganancia']} isCurrency={['ingresos', 'costo_total', 'ganancia']} />
                            </div>
                        )}

                        {/* VISTA 2: VENDEDORES */}
                        {activeTab === 'vendedores' && (
                            <div className="space-y-6 sm:space-y-8">
                                <div className="h-[250px] sm:h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="vendedor_nombre" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} tickFormatter={(val) => val.split(' ')[0]} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} tickFormatter={(val) => `S/${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`} />
                                            <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} formatter={(val) => [`S/ ${Number(val).toFixed(2)}`]} />
                                            <Bar dataKey="ingresos" name="Venta Total" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                                {data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ec4899' : '#3b82f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <TablaGenerica data={data} columnas={['Vendedor', 'N° Pedidos', 'Ingreso Total', 'Ticket Promedio']} keys={['vendedor_nombre', 'num_pedidos', 'ingresos', 'ticket_promedio']} isCurrency={['ingresos', 'ticket_promedio']} />
                            </div>
                        )}

                        {/* VISTA 3: PRODUCTOS */}
                        {activeTab === 'productos' && (
                            <TablaGenerica data={data} columnas={['Producto', 'Unid.', 'Ingreso Bruto', 'Costo Total', 'Ganancia Neta', 'Margen %']} keys={['producto_nombre', 'unidades', 'ingresos', 'costo_total', 'ganancia', 'margen_pct']} isCurrency={['ingresos', 'costo_total', 'ganancia']} isPercent={['margen_pct']} />
                        )}

                        {/* VISTA 4: MÉTODOS DE PAGO */}
                        {activeTab === 'pagos' && (
                            <TablaGenerica data={data} columnas={['Método de Pago', 'Transacciones', 'Monto Total']} keys={['metodo_pago', 'num_pedidos', 'ingresos']} isCurrency={['ingresos']} />
                        )}

                    </div>
                )}
            </div>
            {/* Espaciado extra al fondo para que en celulares no lo tape la barra de navegación del celular si existiera */}
            <div className="h-4 sm:hidden"></div>
        </div>
    );
}

// Sub-componente Refactorizado para ser 100% Mobile-First
function TablaGenerica({ data, columnas, keys, isCurrency = [], isPercent = [] }) {
    return (
        <div className="w-full">

            {/* VISTA MÓVIL: Tarjetas (Se oculta en Desktop) */}
            <div className="md:hidden space-y-3">
                {data.map((row, rIdx) => (
                    <div key={rIdx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        {/* Título de la tarjeta (El primer elemento de la fila) */}
                        <div className="border-b border-slate-50 pb-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">{columnas[0]}</span>
                            <span className="text-sm font-black text-[#1e2a4a]">{row[keys[0]]}</span>
                        </div>

                        {/* Resto de los datos en Grid 2 columnas */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                            {keys.slice(1).map((k, kIdx) => {
                                let val = row[k];
                                let colorClass = "text-[#1e2a4a]";

                                if (isCurrency.includes(k)) {
                                    val = `S/ ${Number(val).toFixed(2)}`;
                                    if (k === 'ganancia') colorClass = "text-emerald-500";
                                } else if (isPercent.includes(k)) {
                                    val = `${Number(val).toFixed(2)}%`;
                                    colorClass = "text-[#ec4899]";
                                } else if (k === 'metodo_pago') {
                                    val = String(val).toUpperCase();
                                }

                                return (
                                    <div key={kIdx}>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">{columnas[kIdx + 1]}</span>
                                        <span className={`text-xs font-bold ${colorClass}`}>{val}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* VISTA DESKTOP: Tabla Tradicional (Se oculta en Móvil) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#f4f6f9]">
                            {columnas.map((col, idx) => (
                                <th key={idx} className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                                {keys.map((k, kIdx) => {
                                    let val = row[k];
                                    let cssClass = "px-5 py-4 text-sm font-bold text-[#1e2a4a] whitespace-nowrap";

                                    if (isCurrency.includes(k)) {
                                        val = `S/ ${Number(val).toFixed(2)}`;
                                        if (k === 'ganancia') cssClass = "px-5 py-4 text-sm font-black text-emerald-500 whitespace-nowrap";
                                    } else if (isPercent.includes(k)) {
                                        val = `${Number(val).toFixed(2)}%`;
                                        cssClass = "px-5 py-4 text-sm font-black text-[#ec4899] whitespace-nowrap";
                                    } else if (k === 'metodo_pago') {
                                        val = String(val).toUpperCase();
                                    }

                                    return <td key={kIdx} className={cssClass}>{val}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}