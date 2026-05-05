import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, Calendar, User, FileText, X, TrendingDown, CheckCircle, AlertTriangle, Lock, Unlock, ShieldCheck, CheckCircle2, Search, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ArqueosAdmin() {
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [periodoFilter, setPeriodoFilter] = useState('todos');
    const [fechaEspecifica, setFechaEspecifica] = useState('');

    // Estados para los Modales
    const [selectedTurno, setSelectedTurno] = useState(null);
    const [gastos, setGastos] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

    useEffect(() => { fetchTurnos(); }, []);

    const fetchTurnos = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('turnos_caja').select('*').order('created_at', { ascending: false });
        if (!error && data) setTurnos(data);
        setLoading(false);
    };

    const handleVerDetalle = async (turno) => {
        setSelectedTurno(turno);
        const { data: dataGastos } = await supabase.from('gastos_caja').select('*').eq('turno_id', turno.id).order('created_at', { ascending: true });
        setGastos(dataGastos || []);
        setIsModalOpen(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - ' + date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    };

    const handleDownloadPDF = () => {
        if (!selectedTurno) return;
        try {
            const doc = new jsPDF();

            doc.setFontSize(22);
            doc.setTextColor(236, 72, 153);
            doc.text("CHANELL", 14, 20);
            doc.setTextColor(59, 130, 246);
            doc.text(" TECNOLOGIA", 48, 20);

            doc.setFontSize(14);
            doc.setTextColor(40, 40, 40);
            doc.text("Reporte Oficial de Arqueo de Caja", 14, 30);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Responsable: ${selectedTurno.usuario_nombre || 'Desconocido'}`, 14, 40);
            doc.text(`Estado: ${selectedTurno.estado.toUpperCase()}`, 14, 46);
            doc.text(`Apertura: ${formatDate(selectedTurno.created_at)}`, 14, 52);
            doc.text(`Cierre: ${selectedTurno.closed_at ? formatDate(selectedTurno.closed_at) : 'En Curso'}`, 14, 58);

            const startY = 70;
            doc.setDrawColor(200, 200, 200);
            doc.line(14, startY - 5, 196, startY - 5);

            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text("Detalle del Flujo de Efectivo:", 14, startY);

            const tableData = [
                ['Fondo Inicial Declarado (Apertura)', `S/ ${parseFloat(selectedTurno.monto_apertura || 0).toFixed(2)}`],
                ['Total Esperado según Sistema', `S/ ${parseFloat(selectedTurno.monto_cierre_esperado || 0).toFixed(2)}`],
                ['Total Declarado Físico (Conteo Ciego)', `S/ ${parseFloat(selectedTurno.monto_cierre_declarado || 0).toFixed(2)}`],
            ];

            autoTable(doc, {
                body: tableData,
                startY: startY + 5,
                theme: 'plain',
                styles: { fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
            });

            let currentY = doc.lastAutoTable.finalY + 10;

            const diferencia = parseFloat(selectedTurno.diferencia || 0);
            let mensajeDiferencia = "CUADRE PERFECTO";
            let colorMensaje = [16, 185, 129];

            if (diferencia > 0) {
                mensajeDiferencia = `SOBRANTE DETECTADO: S/ ${Math.abs(diferencia).toFixed(2)}`;
                colorMensaje = [245, 158, 11];
            } else if (diferencia < 0) {
                mensajeDiferencia = `FALTANTE DETECTADO: S/ ${Math.abs(diferencia).toFixed(2)}`;
                colorMensaje = [239, 68, 68];
            }

            doc.setFontSize(14);
            doc.setTextColor(colorMensaje[0], colorMensaje[1], colorMensaje[2]);
            doc.text(`Resultado Final: ${mensajeDiferencia}`, 14, currentY);

            if (gastos.length > 0) {
                currentY += 15;
                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                doc.text("Egresos y Retiros del Turno:", 14, currentY);

                const gastosRows = gastos.map(g => [
                    new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
                    g.descripcion,
                    `- S/ ${g.monto?.toFixed(2)}`
                ]);

                autoTable(doc, {
                    head: [['Hora', 'Motivo / Descripción', 'Monto']],
                    body: gastosRows,
                    startY: currentY + 5,
                    theme: 'grid',
                    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
                });
                currentY = doc.lastAutoTable.finalY + 10;
            }

            if (selectedTurno.observacion_auditoria) {
                currentY += (gastos.length === 0 ? 15 : 5);
                doc.setFontSize(10);
                doc.setTextColor(30, 64, 175);
                doc.text("Notas de Auditoría (Ajustes):", 14, currentY);
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);

                const splitText = doc.splitTextToSize(selectedTurno.observacion_auditoria, 180);
                doc.text(splitText, 14, currentY + 6);
            }

            const firmasY = 250;
            doc.setDrawColor(100, 100, 100);
            doc.line(30, firmasY, 80, firmasY);
            doc.line(130, firmasY, 180, firmasY);
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text("Firma del Cajero", 55, firmasY + 5, { align: 'center' });
            doc.text("Firma de Gerencia", 155, firmasY + 5, { align: 'center' });

            doc.save(`Arqueo_${selectedTurno.usuario_nombre?.split(' ')[0] || 'Turno'}_${new Date(selectedTurno.created_at).getTime()}.pdf`);
        } catch (error) {
            console.error(error);
            alert("No se pudo generar el documento PDF.");
        }
    };

    const filteredTurnos = turnos.filter(t => {
        const matchesSearch =
            (t.usuario_nombre && t.usuario_nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (t.estado && t.estado.toLowerCase().includes(searchTerm.toLowerCase()));

        if (fechaEspecifica) {
            const turnoDate = new Date(t.created_at).toISOString().split('T')[0];
            return matchesSearch && turnoDate === fechaEspecifica;
        }

        if (periodoFilter === 'todos') return matchesSearch;
        const now = new Date();
        const turnoFecha = new Date(t.created_at);
        if (periodoFilter === 'hoy') {
            return matchesSearch && turnoFecha.toDateString() === now.toDateString();
        } else if (periodoFilter === 'semana') {
            const hace7dias = new Date(now); hace7dias.setDate(now.getDate() - 7);
            return matchesSearch && turnoFecha >= hace7dias;
        } else if (periodoFilter === 'mes') {
            return matchesSearch && turnoFecha.getMonth() === now.getMonth() && turnoFecha.getFullYear() === now.getFullYear();
        }
        return matchesSearch;
    });

    return (
        <div className="w-full space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">

            {/* ENCABEZADO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full sm:w-auto flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                            <Wallet className="text-[#3b82f6]" size={28} />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Arqueos</span>
                        </h2>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-2">Auditoría, aperturas y control de faltantes.</p>
                    </div>
                    <span className="bg-[#3b82f6]/10 text-[#3b82f6] px-3 py-1.5 rounded-xl text-[10px] font-black border border-[#3b82f6]/20 uppercase tracking-widest sm:hidden">
                        {filteredTurnos.length}
                    </span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <span className="bg-[#3b82f6]/10 text-[#3b82f6] px-4 py-2 rounded-2xl text-xs font-black border border-[#3b82f6]/20 uppercase tracking-widest">
                        {filteredTurnos.length} turnos
                    </span>
                </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-white p-4 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col xl:flex-row gap-3">
                {/* Buscador */}
                <div className="relative w-full xl:flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cajero o estado..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#f4f6f9] hover:bg-slate-100 border border-transparent rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-[#1e2a4a] outline-none focus:bg-white focus:border-[#ec4899] transition-all placeholder:font-medium placeholder:text-slate-400"
                    />
                </div>

                {/* Contenedor de Periodos y Fecha en Móvil */}
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    {/* Selector de período */}
                    <div className="grid grid-cols-2 sm:flex gap-2">
                        {[{ v: 'todos', l: 'Todos' }, { v: 'hoy', l: 'Hoy' }, { v: 'semana', l: '7 días' }, { v: 'mes', l: 'Mes' }].map(op => (
                            <button
                                key={op.v}
                                onClick={() => { setPeriodoFilter(op.v); setFechaEspecifica(''); }}
                                className={`px-4 py-3 sm:py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-center ${periodoFilter === op.v && !fechaEspecifica
                                    ? 'bg-[#1e2a4a] text-white shadow-md'
                                    : 'bg-[#f4f6f9] text-slate-500 hover:bg-slate-200'
                                    }`}
                            >
                                {op.l}
                            </button>
                        ))}
                    </div>

                    {/* Date picker de fecha específica */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 sm:w-auto">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            <input
                                type="date"
                                value={fechaEspecifica}
                                onChange={(e) => { setFechaEspecifica(e.target.value); setPeriodoFilter('todos'); }}
                                className="w-full sm:w-auto bg-[#f4f6f9] hover:bg-slate-100 border border-transparent focus:bg-white focus:border-[#ec4899] rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-[#1e2a4a] outline-none transition-all cursor-pointer"
                            />
                        </div>
                        {fechaEspecifica && (
                            <button
                                onClick={() => setFechaEspecifica('')}
                                className="p-3.5 bg-[#f4f6f9] hover:bg-red-50 text-slate-400 hover:text-[#ec4899] rounded-2xl transition-colors shrink-0"
                                title="Limpiar fecha"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* TABLA PRINCIPAL Y CARDS MÓVILES */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : filteredTurnos.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center">
                        <Wallet size={48} className="text-slate-200 mb-4" />
                        <p className="font-bold text-[#1e2a4a]">No hay turnos registrados.</p>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL: Tarjetas */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredTurnos.map(turno => {
                                const dif = turno.diferencia || 0;
                                let difStyle = "text-slate-500 bg-slate-100 border-slate-200";
                                if (turno.estado === 'cerrado') {
                                    if (dif < 0) difStyle = "text-red-600 bg-red-50 border-red-100";
                                    else if (dif > 0) difStyle = "text-amber-600 bg-amber-50 border-amber-100";
                                    else difStyle = "text-emerald-600 bg-emerald-50 border-emerald-100";
                                }

                                return (
                                    <div key={turno.id} className="p-5 flex flex-col gap-4">
                                        {/* Cabecera Tarjeta */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-[#1e2a4a] text-sm">{turno.usuario_nombre || 'Vendedor'}</h3>
                                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{formatDate(turno.created_at)}</div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest ${turno.estado === 'abierto' ? 'bg-amber-100 text-amber-600' : 'bg-[#f4f6f9] text-[#1e2a4a]'}`}>
                                                {turno.estado}
                                            </span>
                                        </div>

                                        {/* Metricas */}
                                        <div className="grid grid-cols-2 gap-3 bg-[#f4f6f9]/50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Base Sencillo</p>
                                                <p className="font-black text-[#1e2a4a] text-sm">S/ {turno.monto_apertura?.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Diferencia</p>
                                                {turno.estado === 'cerrado' ? (
                                                    <span className={`inline-flex px-2 py-0.5 rounded-[6px] text-[10px] font-black border ${difStyle}`}>
                                                        S/ {Math.abs(dif).toFixed(2)} {dif < 0 ? '(Falta)' : dif > 0 ? '(Sobra)' : '(OK)'}
                                                    </span>
                                                ) : <span className="text-slate-400 text-xs font-bold">Pendiente</span>}
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <button onClick={() => handleVerDetalle(turno)} className="w-full flex justify-center items-center gap-2 py-3 bg-[#f4f6f9] hover:bg-[#3b82f6]/10 text-slate-600 hover:text-[#3b82f6] rounded-xl text-xs font-bold transition-all mt-1">
                                            <FileText size={16} /> Ver Detalle de Arqueo
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* VISTA DESKTOP: Tabla */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[900px]">
                                <thead>
                                    <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest border-b border-slate-100">
                                        <th className="p-5 font-black"><Calendar size={14} className="inline mr-1" /> Apertura / Cierre</th>
                                        <th className="p-5 font-black"><User size={14} className="inline mr-1" /> Responsable</th>
                                        <th className="p-5 font-black text-center">Estado</th>
                                        <th className="p-5 font-black text-right">Base / Sencillo</th>
                                        <th className="p-5 font-black text-right">Diferencia</th>
                                        <th className="p-5 font-black text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredTurnos.map((turno) => {
                                        const dif = turno.diferencia || 0;
                                        let difStyle = "text-slate-500 bg-slate-100 border-slate-200";
                                        let difIcon = <CheckCircle size={12} />;

                                        if (turno.estado === 'cerrado') {
                                            if (dif < 0) { difStyle = "text-red-600 bg-red-50 border-red-100"; difIcon = <TrendingDown size={12} />; }
                                            else if (dif > 0) { difStyle = "text-amber-600 bg-amber-50 border-amber-100"; difIcon = <AlertTriangle size={12} />; }
                                            else { difStyle = "text-emerald-600 bg-emerald-50 border-emerald-100"; difIcon = <CheckCircle2 size={12} />; }
                                        }

                                        return (
                                            <tr key={turno.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-5">
                                                    <div className="text-xs font-bold text-[#1e2a4a]">{formatDate(turno.created_at)}</div>
                                                    {turno.closed_at ? <div className="text-[10px] text-slate-400 mt-1">Cierre: {formatDate(turno.closed_at)}</div> : <div className="text-[10px] text-[#3b82f6] mt-1 animate-pulse font-bold">Turno en curso...</div>}
                                                </td>
                                                <td className="p-5">
                                                    <div className="text-sm font-bold text-[#1e2a4a]">{turno.usuario_nombre || 'Vendedor'}</div>
                                                    {turno.observacion_auditoria && <span className="text-[9px] bg-blue-100 text-[#3b82f6] font-bold px-1.5 py-0.5 rounded mt-1 inline-block">Auditado</span>}
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className={`px-2.5 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest ${turno.estado === 'abierto' ? 'bg-amber-100 text-amber-600' : 'bg-[#f4f6f9] text-[#1e2a4a]'}`}>
                                                        {turno.estado === 'abierto' ? <Unlock size={10} className="inline mr-1" /> : <Lock size={10} className="inline mr-1" />} {turno.estado}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-right font-medium text-slate-600">S/ {turno.monto_apertura?.toFixed(2)}</td>
                                                <td className="p-5 text-right">
                                                    {turno.estado === 'cerrado' ? (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[11px] font-black border ${difStyle}`}>
                                                            {difIcon} S/ {Math.abs(dif).toFixed(2)} {dif < 0 ? '(Falta)' : dif > 0 ? '(Sobra)' : '(OK)'}
                                                        </span>
                                                    ) : <span className="text-slate-300 text-xs">Pendiente</span>}
                                                </td>
                                                <td className="p-5 text-center">
                                                    <button onClick={() => handleVerDetalle(turno)} className="px-4 py-2.5 bg-[#f4f6f9] hover:bg-slate-200 border border-transparent text-slate-600 hover:text-[#3b82f6] rounded-xl text-xs font-bold transition-all flex items-center gap-2 mx-auto">
                                                        <FileText size={14} /> Detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* ============================================================== */}
            {/* MODAL 1: DETALLE DEL ARQUEO (Mobile First Bottom Sheet)        */}
            {/* ============================================================== */}
            {isModalOpen && selectedTurno && (
                <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in duration-300">

                        {/* Handle bar for mobile */}
                        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>

                        <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#f4f6f9]/50">
                            <div className="w-full sm:w-auto flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] flex items-center gap-2">
                                        <FileText className="text-[#3b82f6]" size={24} /> RESUMEN DE ARQUEO
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Responsable: <span className="font-bold text-[#1e2a4a]">{selectedTurno.usuario_nombre || 'Vendedor'}</span></p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-[#ec4899] p-2 hover:bg-[#ec4899]/10 rounded-full transition-colors sm:hidden">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex flex-row items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                {selectedTurno.estado === 'cerrado' && (
                                    <button onClick={() => setIsAdjustModalOpen(true)} className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold transition-colors uppercase tracking-widest">
                                        <ShieldCheck size={16} /> Auditoría
                                    </button>
                                )}
                                <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-[#3b82f6] text-white hover:bg-blue-600 px-4 py-3 sm:py-2.5 rounded-xl text-xs font-black transition-colors shadow-md uppercase tracking-widest">
                                    <Download size={16} /> Exportar
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="hidden sm:block text-slate-400 hover:text-[#ec4899] p-2 hover:bg-[#ec4899]/10 rounded-full transition-colors ml-1">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6 bg-white">
                            {selectedTurno.observacion_auditoria && (
                                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                                    <h4 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest flex items-center gap-1 mb-2">
                                        <ShieldCheck size={14} /> Notas de Auditoría
                                    </h4>
                                    <p className="text-xs sm:text-sm text-blue-900 font-medium">{selectedTurno.observacion_auditoria}</p>
                                </div>
                            )}

                            {/* Grilla Financiera responsive */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-[#f4f6f9] p-3 sm:p-4 rounded-2xl border border-transparent">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Apertura</p>
                                    <p className="text-base sm:text-lg font-black text-[#1e2a4a]">S/ {selectedTurno.monto_apertura?.toFixed(2)}</p>
                                </div>
                                <div className="bg-emerald-50/50 p-3 sm:p-4 rounded-2xl border border-emerald-100">
                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Esperado Sistema</p>
                                    <p className="text-base sm:text-lg font-black text-emerald-600">S/ {selectedTurno.monto_cierre_esperado?.toFixed(2)}</p>
                                </div>
                                <div className="bg-blue-50/50 p-3 sm:p-4 rounded-2xl border border-blue-100">
                                    <p className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest mb-1">Declarado Físico</p>
                                    <p className="text-base sm:text-lg font-black text-[#3b82f6]">S/ {selectedTurno.monto_cierre_declarado?.toFixed(2)}</p>
                                </div>
                                <div className={`p-3 sm:p-4 rounded-2xl border ${selectedTurno.diferencia < 0 ? 'bg-red-50 border-red-100' : selectedTurno.diferencia > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${selectedTurno.diferencia < 0 ? 'text-red-600' : selectedTurno.diferencia > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Diferencia</p>
                                    <p className={`text-base sm:text-lg font-black ${selectedTurno.diferencia < 0 ? 'text-red-600' : selectedTurno.diferencia > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                        S/ {selectedTurno.diferencia?.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Detalles Egresos */}
                            <div>
                                <h4 className="text-xs sm:text-sm font-bold text-[#1e2a4a] mb-3 flex items-center gap-2">
                                    <TrendingDown className="text-amber-500" size={16} /> Egresos del Turno
                                </h4>
                                {gastos.length === 0 ? (
                                    <div className="bg-[#f4f6f9] rounded-2xl p-6 text-center text-xs text-slate-400 font-medium">
                                        No se registraron extracciones de dinero.
                                    </div>
                                ) : (
                                    <>
                                        {/* Móvil: Lista de Gastos */}
                                        <div className="md:hidden space-y-2">
                                            {gastos.map(g => (
                                                <div key={g.id} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                                    <div>
                                                        <p className="font-bold text-[#1e2a4a] text-xs">{g.descripcion}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <span className="font-black text-amber-500 text-sm">- S/ {g.monto?.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Desktop: Tabla de Gastos */}
                                        <div className="hidden md:block border border-slate-100 rounded-2xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black">
                                                    <tr>
                                                        <th className="p-4">Hora</th>
                                                        <th className="p-4">Motivo / Descripción</th>
                                                        <th className="p-4 text-right">Monto Retirado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {gastos.map(g => (
                                                        <tr key={g.id} className="hover:bg-slate-50/50">
                                                            <td className="p-4 text-slate-400 font-medium">{new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                                                            <td className="p-4 font-bold text-[#1e2a4a]">{g.descripcion}</td>
                                                            <td className="p-4 text-right font-black text-amber-500">- S/ {g.monto?.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL 2: COMPONENTE AISLADO DE AUDITORÍA                     */}
            {/* ============================================================== */}
            {isAdjustModalOpen && selectedTurno && (
                <ModalAjusteAuditoria
                    turno={selectedTurno}
                    onClose={() => setIsAdjustModalOpen(false)}
                    onSuccess={(nuevoTurno) => {
                        setIsAdjustModalOpen(false);
                        fetchTurnos();
                        setSelectedTurno(nuevoTurno);
                    }}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// COMPONENTE AISLADO: Modal de Ajuste (Refactorizado para Móvil)
// ---------------------------------------------------------------------------
function ModalAjusteAuditoria({ turno, onClose, onSuccess }) {
    const [adjustMonto, setAdjustMonto] = useState('');
    const [adjustNota, setAdjustNota] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

    const esperadoSistema = turno?.monto_cierre_esperado || 0;
    const montoDigitado = parseFloat(adjustMonto) || 0;
    const diffDinamica = adjustMonto === '' ? 0 : montoDigitado - esperadoSistema;

    const handleGuardarAjuste = async (e) => {
        e.preventDefault();
        if (!adjustNota.trim()) return alert("Debes ingresar una justificación para la auditoría.");
        setIsAdjusting(true);

        const nuevoMontoDeclarado = montoDigitado;
        const fechaAjuste = new Date().toLocaleDateString('es-PE') + ' ' + new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

        const notaFinal = turno.observacion_auditoria
            ? `${turno.observacion_auditoria} | [${fechaAjuste}]: ${adjustNota}`
            : `[${fechaAjuste} Auditoría]: ${adjustNota}`;

        const { error } = await supabase.from('turnos_caja').update({
            monto_cierre_declarado: nuevoMontoDeclarado,
            diferencia: diffDinamica,
            observacion_auditoria: notaFinal
        }).eq('id', turno.id);

        if (error) {
            alert("Error al guardar ajuste: " + error.message);
            setIsAdjusting(false);
        } else {
            alert("El arqueo ha sido ajustado correctamente.");
            onSuccess({
                ...turno,
                monto_cierre_declarado: nuevoMontoDeclarado,
                diferencia: diffDinamica,
                observacion_auditoria: notaFinal
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in duration-200">

                {/* Handle bar for mobile */}
                <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-[#f4f6f9]/50">
                    <div>
                        <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] flex items-center gap-2">
                            <ShieldCheck className="text-amber-500" size={24} /> AUDITORÍA
                        </h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">
                            Cajero: <span className="font-black text-[#1e2a4a]">{turno.usuario_nombre}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-50 rounded-full transition-colors hidden sm:block">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 sm:p-8 bg-white">
                    <form onSubmit={handleGuardarAjuste} className="space-y-6">

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Físico Encontrado</label>
                                    <span className="text-[10px] text-slate-400 font-bold">Esperado: S/ {esperadoSistema.toFixed(2)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAdjustMonto(esperadoSistema)}
                                    className="text-[9px] sm:text-[10px] text-[#3b82f6] bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-[#ec4899] hover:text-white font-black uppercase tracking-widest transition-colors"
                                >
                                    Cuadrar Exacto
                                </button>
                            </div>

                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">S/</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    autoFocus
                                    value={adjustMonto}
                                    onChange={(e) => setAdjustMonto(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full text-2xl sm:text-3xl font-black text-[#1e2a4a] bg-[#f4f6f9] border border-transparent rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-[#ec4899] focus:bg-white transition-colors"
                                />
                            </div>

                            {adjustMonto !== '' && (
                                <div className="mt-3 flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-500">Diferencia proyectada:</span>
                                    <span className={`font-black px-2.5 py-1 rounded-md ${diffDinamica === 0 ? 'bg-emerald-100 text-emerald-600' : diffDinamica < 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {diffDinamica > 0 ? '+' : ''}{diffDinamica.toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Justificación</label>
                            <textarea
                                required
                                rows="3"
                                value={adjustNota}
                                onChange={(e) => setAdjustNota(e.target.value)}
                                placeholder="Ej: Faltan 10 soles por cambio devuelto..."
                                className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl p-4 outline-none focus:border-[#ec4899] focus:bg-white text-sm font-medium text-[#1e2a4a] resize-none transition-colors"
                            ></textarea>
                        </div>

                        <button disabled={isAdjusting} type="submit" className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl hover:bg-amber-600 transition-all uppercase tracking-widest text-xs disabled:opacity-50 shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:-translate-y-0.5">
                            {isAdjusting ? 'Guardando...' : 'Confirmar Ajuste'}
                        </button>
                        <button type="button" onClick={onClose} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest sm:hidden">
                            Cancelar Auditoría
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}