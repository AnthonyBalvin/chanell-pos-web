import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { DollarSign, TrendingUp, CreditCard, Package, Percent, Wallet, ArrowRight, AlertTriangle, CheckCircle2, Calendar, Banknote, Landmark, Smartphone, BadgeDollarSign } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Link } from 'react-router-dom';

export default function DashboardAdmin() {
    const { role } = useAuth();
    const [pedidos, setPedidos] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [stockCritico, setStockCritico] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS PARA LOS TOTALES DEL MOTOR RPC ---
    const [totalVentasRPC, setTotalVentasRPC] = useState(0);
    const [gananciaNetaRPC, setGananciaNetaRPC] = useState(0);
    const [totalPedidosRPC, setTotalPedidosRPC] = useState(0);

    const [periodo, setPeriodo] = useState('mes');

    useEffect(() => {
        if (role === 'admin' || role === 'supervisor') {
            fetchData();
        }
    }, [role, periodo]);

    if (role === 'vendedor') {
        return <Navigate to="/admin/caja" replace />;
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate = new Date();

            if (periodo === 'hoy') {
                startDate.setHours(0, 0, 0, 0);
            } else if (periodo === 'semana') {
                startDate.setDate(now.getDate() - 7);
            } else if (periodo === 'mes') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (periodo === 'anio') {
                startDate = new Date(now.getFullYear(), 0, 1);
            }

            const isoStartDate = startDate.toISOString();
            const isoEndDate = new Date().toISOString();

            // 1. LLAMADA AL MOTOR RPC (Para asegurar exactitud en los totales)
            const { data: statsData } = await supabase.rpc('get_dashboard_stats', {
                p_start_date: isoStartDate,
                p_end_date: isoEndDate
            });

            if (statsData && statsData[0]) {
                setTotalVentasRPC(Number(statsData[0].total_ventas));
                setGananciaNetaRPC(Number(statsData[0].total_ganancia));
                setTotalPedidosRPC(Number(statsData[0].num_pedidos));
            }

            // 2. CONSULTAS PARA GRÁFICOS Y DETALLES
            const { data: dataPedidos } = await supabase
                .from('pedidos')
                .select('id, total, estado, items, created_at, metodo_pago, ticket, cliente_nombre')
                .gte('created_at', isoStartDate)
                .order('created_at', { ascending: false });

            const { data: dataGastos } = await supabase
                .from('gastos_caja')
                .select('monto, created_at')
                .gte('created_at', isoStartDate);

            const { data: dataStock } = await supabase
                .from('productos')
                .select('id, name, stock, stock_minimo')
                .lte('stock', 15)
                .order('stock', { ascending: true });

            if (dataPedidos) setPedidos(dataPedidos);
            if (dataGastos) setGastos(dataGastos);
            if (dataStock) {
                const productosEnAlerta = dataStock.filter(p => p.stock <= (p.stock_minimo || 5)).slice(0, 6);
                setStockCritico(productosEnAlerta);
            }
        } catch (error) {
            console.error("Error cargando dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DE CÁLCULOS PARA GRÁFICOS Y TOP 5 ---
    const ventasCompletadas = pedidos.filter(p => p.estado === 'vendido' || p.estado === 'enviado');
    const productosMap = {};
    const pagosMap = {};

    ventasCompletadas.forEach(p => {
        const metodo = p.metodo_pago || 'otro';
        pagosMap[metodo] = (pagosMap[metodo] || 0) + (p.total || 0);

        if (p.items && Array.isArray(p.items)) {
            p.items.forEach(item => {
                const prod = item.product;
                const qty = item.quantity || 1;
                const costoUnitario = prod.costo || 0;

                if (!productosMap[prod.name]) {
                    productosMap[prod.name] = { name: prod.name, cantidad: 0, ingresos: 0, ganancia: 0 };
                }
                productosMap[prod.name].cantidad += qty;
                productosMap[prod.name].ingresos += (prod.price * qty);
                productosMap[prod.name].ganancia += ((prod.price - costoUnitario) * qty);
            });
        }
    });

    const totalGastosOperativos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
    // Usamos el valor del RPC para la ganancia neta, restándole los gastos operativos locales
    const gananciaFinal = gananciaNetaRPC - totalGastosOperativos;
    const margenBeneficio = totalVentasRPC > 0 ? (gananciaFinal / totalVentasRPC) * 100 : 0;
    const ticketPromedio = totalPedidosRPC > 0 ? totalVentasRPC / totalPedidosRPC : 0;

    const topProductos = Object.values(productosMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
    const COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];
    const datosPagos = Object.keys(pagosMap).map(key => ({
        name: key.toUpperCase(),
        value: pagosMap[key]
    })).sort((a, b) => b.value - a.value);

    // --- GRAN TOTAL: desglose por método de pago ---
    const metodosConfig = [
        { keys: ['efectivo'], label: 'Efectivo', icon: Banknote, color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        { keys: ['banco', 'transferencia'], label: 'Transferencia', icon: Landmark, color: '#3b82f6', bg: 'bg-blue-50', text: 'text-[#3b82f6]', border: 'border-blue-100' },
        { keys: ['yape', 'yape_pos', 'plin'], label: 'Yape / Plin', icon: Smartphone, color: '#8b5cf6', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        { keys: ['tarjeta', 'pos', 'card'], label: 'Tarjeta / POS', icon: CreditCard, color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    ];
    const subtotales = metodosConfig.map(m => ({
        ...m,
        total: m.keys.reduce((sum, k) => sum + (pagosMap[k] || pagosMap[k.toUpperCase()] || 0), 0)
    }));
    // Cualquier método que no haya caído en las categorías anteriores
    const todasLasKeys = metodosConfig.flatMap(m => m.keys);
    const otrosTotal = Object.entries(pagosMap)
        .filter(([k]) => !todasLasKeys.includes(k.toLowerCase()))
        .reduce((sum, [, v]) => sum + v, 0);
    const granTotal = subtotales.reduce((sum, m) => sum + m.total, 0) + otrosTotal;

    const procesarEvolucion = () => {
        const diasAMostrar = periodo === 'hoy' ? 1 : periodo === 'semana' ? 7 : periodo === 'mes' ? 15 : 30;
        const diasArray = [];
        const hoy = new Date();
        for (let i = diasAMostrar - 1; i >= 0; i--) {
            const d = new Date(hoy);
            d.setDate(d.getDate() - i);
            diasArray.push(d.toISOString().split('T')[0]);
        }
        return diasArray.map(fecha => {
            const ventasDelDia = ventasCompletadas.filter(p => p.created_at.startsWith(fecha));
            const gastosDelDia = gastos.filter(g => g.created_at.startsWith(fecha));
            const ingresosDia = ventasDelDia.reduce((sum, p) => sum + (p.total || 0), 0);
            const gastosOpDia = gastosDelDia.reduce((sum, g) => sum + (g.monto || 0), 0);
            let costoDia = 0;
            ventasDelDia.forEach(p => {
                if (p.items) p.items.forEach(i => costoDia += (i.product.costo || 0) * i.quantity);
            });
            const gananciaRealDia = ingresosDia - costoDia - gastosOpDia;
            return {
                name: new Date(fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
                Ingresos: ingresosDia,
                Ganancia: gananciaRealDia > 0 ? gananciaRealDia : 0
            };
        });
    };
    const datosEvolucion = procesarEvolucion();

    return (
        <div className="w-full space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <TrendingUp className="text-[#3b82f6]" size={32} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Inteligencia de Negocio</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Análisis financiero con motor de cálculo optimizado.</p>
                </div>
                <div className="relative min-w-[200px] w-full sm:w-auto">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ec4899]" size={18} />
                    <select
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-slate-200 text-[#1e2a4a] font-bold rounded-2xl pl-12 pr-4 py-3 outline-none appearance-none cursor-pointer transition-colors"
                    >
                        <option value="hoy">Hoy</option>
                        <option value="semana">Últimos 7 Días</option>
                        <option value="mes">Este Mes</option>
                        <option value="anio">Todo el Año</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col justify-center items-center h-[50vh] text-slate-400 space-y-4">
                    <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold tracking-widest uppercase text-xs text-[#1e2a4a]">Sincronizando con el servidor...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-start justify-between group hover:-translate-y-1 transition-all duration-300">
                            <div>
                                <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase mb-2">Ingresos Brutos</p>
                                <h3 className="text-3xl font-black text-[#1e2a4a] tracking-tighter">S/ {totalVentasRPC.toFixed(2)}</h3>
                            </div>
                            <div className="p-3.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-2xl group-hover:bg-[#3b82f6] group-hover:text-white transition-colors"><DollarSign size={24} /></div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-start justify-between group hover:-translate-y-1 transition-all duration-300">
                            <div>
                                <p className={`${gananciaFinal >= 0 ? 'text-emerald-500' : 'text-red-500'} text-[10px] font-black tracking-widest uppercase mb-2`}>Ganancia Neta</p>
                                <h3 className={`text-3xl font-black tracking-tighter ${gananciaFinal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>S/ {gananciaFinal.toFixed(2)}</h3>
                            </div>
                            <div className={`p-3.5 rounded-2xl transition-colors ${gananciaFinal >= 0 ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white'}`}>
                                <Wallet size={24} />
                            </div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-start justify-between group hover:-translate-y-1 transition-all duration-300">
                            <div>
                                <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase mb-2">Margen Real</p>
                                <h3 className="text-3xl font-black text-[#1e2a4a] tracking-tighter">{margenBeneficio.toFixed(1)}%</h3>
                            </div>
                            <div className="p-3.5 bg-[#ec4899]/10 text-[#ec4899] rounded-2xl group-hover:bg-[#ec4899] group-hover:text-white transition-colors"><Percent size={24} /></div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex items-start justify-between group hover:-translate-y-1 transition-all duration-300">
                            <div>
                                <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase mb-2">Ticket Promedio</p>
                                <h3 className="text-3xl font-black text-[#1e2a4a] tracking-tighter">S/ {ticketPromedio.toFixed(2)}</h3>
                            </div>
                            <div className="p-3.5 bg-amber-50 text-amber-500 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-colors"><TrendingUp size={24} /></div>
                        </div>
                    </div>

                    {/* ====== WIDGET: GRAN TOTAL DEL DÍA ====== */}
                    <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-slate-50 bg-[#f4f6f9]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-xs font-black text-[#1e2a4a] uppercase tracking-widest flex items-center gap-2">
                                    <BadgeDollarSign size={18} className="text-[#ec4899]" />
                                    Resumen Financiero — Gran Total
                                </h3>
                                <p className="text-slate-400 text-[11px] mt-1">Todos los ingresos del período, por método de cobro.</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gran Total</p>
                                    <p className="text-2xl font-black text-[#1e2a4a] tracking-tight">S/ {granTotal.toFixed(2)}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                                    style={{ background: 'linear-gradient(135deg, #ec4899, #3b82f6)' }}>
                                    <BadgeDollarSign size={22} className="text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-50">
                            {subtotales.map((m, i) => {
                                const Icon = m.icon;
                                const pct = granTotal > 0 ? (m.total / granTotal) * 100 : 0;
                                return (
                                    <div key={i} className="p-5 sm:p-6 flex flex-col gap-3 hover:bg-slate-50/80 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${m.text}`}>{m.label}</span>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${m.bg} ${m.text}`}>
                                                <Icon size={15} />
                                            </div>
                                        </div>
                                        <p className="text-xl font-black text-[#1e2a4a] tracking-tight">S/ {m.total.toFixed(2)}</p>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%`, background: m.color }} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold">{pct.toFixed(1)}% del total</p>
                                    </div>
                                );
                            })}
                        </div>
                        {otrosTotal > 0 && (
                            <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400">Otros métodos</span>
                                <span className="text-sm font-black text-slate-600">S/ {otrosTotal.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 lg:col-span-2 flex flex-col">
                            <h3 className="text-sm font-black text-[#1e2a4a] mb-6 uppercase tracking-widest">Evolución: Ingresos vs Ganancia</h3>
                            <div className="flex-1 w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={datosEvolucion} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} /><stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} tickFormatter={(value) => `S/${value}`} />
                                        <RechartsTooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px' }} formatter={(value) => [`S/ ${value.toFixed(2)}`]} />
                                        <Area type="monotone" dataKey="Ingresos" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" />
                                        <Area type="monotone" dataKey="Ganancia" stroke="#ec4899" strokeWidth={4} fillOpacity={1} fill="url(#colorGanancia)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col">
                            <h3 className="text-sm font-black text-[#1e2a4a] mb-2 uppercase tracking-widest">Flujo por Métodos</h3>
                            <div className="flex-1 min-h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={datosPagos} cx="50%" cy="50%" innerRadius={75} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                                            {datosPagos.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <RechartsTooltip formatter={(value) => `S/ ${value.toFixed(2)}`} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '800', color: '#1e2a4a' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-50 bg-[#f4f6f9]/50">
                                <h3 className="text-xs font-black text-[#1e2a4a] uppercase tracking-widest flex items-center gap-2"><Package size={16} className="text-[#3b82f6]" /> Top 5 Productos</h3>
                            </div>
                            <div className="p-2 flex-1 overflow-y-auto">
                                {topProductos.map((prod, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-[#f4f6f9] flex items-center justify-center text-[#1e2a4a] font-black text-xs">{idx + 1}</div>
                                            <div><p className="text-sm font-bold text-[#1e2a4a] line-clamp-1">{prod.name}</p><p className="text-[10px] text-slate-400 uppercase tracking-widest">{prod.cantidad} Unds</p></div>
                                        </div>
                                        <div className="text-right"><p className="text-sm font-black text-emerald-500">S/ {prod.ganancia.toFixed(2)}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-50 bg-[#f4f6f9]/50 flex justify-between items-center">
                                <h3 className="text-xs font-black text-[#1e2a4a] uppercase tracking-widest flex items-center gap-2"><CreditCard size={16} className="text-[#ec4899]" /> Operaciones Recientes</h3>
                            </div>
                            <div className="p-2 flex-1 overflow-y-auto">
                                {pedidos.slice(0, 5).map(pedido => (
                                    <div key={pedido.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] font-bold shrink-0"><ArrowRight size={14} /></div>
                                            <div><p className="text-sm font-bold text-[#1e2a4a] line-clamp-1">{pedido.cliente_nombre}</p><p className="text-[10px] text-slate-400 uppercase">#{pedido.ticket}</p></div>
                                        </div>
                                        <div className="text-right"><p className="text-sm font-black text-[#1e2a4a]">S/ {pedido.total?.toFixed(2)}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-red-50 bg-red-50/30 flex justify-between items-center">
                                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={16} /> Alerta de Stock</h3>
                            </div>
                            <div className="p-4 flex-1 overflow-y-auto space-y-3">
                                {stockCritico.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-8">
                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3"><CheckCircle2 size={32} /></div>
                                        <p className="text-sm font-bold">Todo en orden</p>
                                    </div>
                                ) : (
                                    stockCritico.map((prod) => (
                                        <div key={prod.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-red-100 group">
                                            <div className="flex flex-col pr-2"><span className="text-sm font-bold text-[#1e2a4a]">{prod.name}</span><span className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1">Stock: {prod.stock}</span></div>
                                            <Link to="/admin/productos" className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-full"><ArrowRight size={14} /></Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}