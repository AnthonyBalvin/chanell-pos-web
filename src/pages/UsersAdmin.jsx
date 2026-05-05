import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Users, Edit, Trash2, X, Calendar, TrendingUp, Receipt, Package, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import gsap from 'gsap';
import { useChanellUI } from '../context/UIContext';

export default function UsersAdmin() {
    const { notify, confirm } = useChanellUI();
    const [usuarios, setUsuarios] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userSelected, setUserSelected] = useState(null);
    const modalRef = useRef(null);
    const overlayRef = useRef(null);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol: 'vendedor' });
    const addModalRef = useRef(null);
    const addOverlayRef = useRef(null);

    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [userToAudit, setUserToAudit] = useState(null);
    const auditModalRef = useRef(null);
    const auditOverlayRef = useRef(null);
    const [turnosAbiertos, setTurnosAbiertos] = useState([]);

    useEffect(() => {
        fetchDatos();
    }, []);

    const fetchDatos = async () => {
        setLoading(true);
        const [resUsuarios, resPedidos, resTurnos] = await Promise.all([
            supabase.from('perfiles').select('*').order('created_at', { ascending: false }),
            supabase.from('pedidos').select('id, ticket, total, estado, created_at, vendedor_id').order('created_at', { ascending: false }),
            supabase.from('turnos_caja').select('*').eq('estado', 'abierto')
        ]);

        if (!resUsuarios.error) setUsuarios(resUsuarios.data);
        if (!resPedidos.error) setPedidos(resPedidos.data);
        if (!resTurnos.error) setTurnosAbiertos(resTurnos.data);

        setLoading(false);
    };

    const handleCierreForzado = async (turno, nombreEmpleado) => {
        const isConfirmed = await confirm("Forzar Cierre de Caja", `ADVERTENCIA: ¿Estás seguro de FORZAR EL CIERRE de la caja de ${nombreEmpleado}?\n\nEl sistema calculará las ventas y cerrará la sesión sin conteo físico del efectivo.`, true);
        if (!isConfirmed) return;

        setLoading(true);
        const { error } = await supabase.rpc('cierre_forzado_caja', {
            turno_id_target: turno.id
        });

        if (error) notify("Error al forzar cierre: " + error.message, "error");
        else {
            notify(`✅ Caja de ${nombreEmpleado} cerrada exitosamente.`, "success");
            fetchDatos();
        }
        setLoading(false);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleAccionAcceso = async (user) => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (user.id === currentUser.id) return notify("No puedes alterar tu propia cuenta de administrador.", "error");

        if (user.estado === 'inactivo') {
            const isConfirmed = await confirm("Reactivar Acceso", `¿Deseas REACTIVAR el acceso de ${user.nombre} al sistema?`);
            if (isConfirmed) {
                setLoading(true);
                const { error } = await supabase.from('perfiles').update({ estado: 'activo' }).eq('id', user.id);
                if (error) notify("Error al reactivar: " + error.message, "error");
                else {
                    notify(`✅ Acceso reactivado. ${user.nombre} ya puede operar nuevamente.`, "success");
                    fetchDatos();
                }
                setLoading(false);
            }
            return;
        }

        const tieneHistorial = pedidos.some(p => p.vendedor_id === user.id);

        if (tieneHistorial) {
            const isConfirmed = await confirm("Suspender Acceso", `⚠️ ${user.nombre} ya tiene tickets de venta en su historial.\n\nPor seguridad contable no se puede borrar de raíz. ¿Deseas SUSPENDER su acceso para que no pueda entrar al sistema?`, true);
            if (isConfirmed) {
                setLoading(true);
                const { error } = await supabase.from('perfiles').update({ estado: 'inactivo' }).eq('id', user.id);
                if (error) notify("Error al suspender: " + error.message, "error");
                else {
                    notify(`🚫 Acceso suspendido. ${user.nombre} ya no podrá operar la caja.`, "success");
                    fetchDatos();
                }
                setLoading(false);
            }
        } else {
            const isConfirmed = await confirm("Eliminar Definitivamente", `¿Estás 100% seguro de eliminar definitivamente a ${user.nombre}?\n\nAl no tener historial de ventas, su perfil se borrará limpiamente del sistema.`, true);
            if (isConfirmed) {
                setLoading(true);
                const { error } = await supabase.rpc('eliminar_usuario_admin', {
                    usuario_id_a_borrar: user.id
                });
                if (error) notify("No se pudo eliminar: " + error.message, "error");
                else {
                    notify(`El usuario ${user.nombre} ha sido eliminado completamente.`, "success");
                    fetchDatos();
                }
                setLoading(false);
            }
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('perfiles').update({
            nombre: userSelected.nombre, rol: userSelected.rol, email: userSelected.email
        }).eq('id', userSelected.id);

        if (error) notify(error.message, "error");
        else {
            notify("Perfil actualizado correctamente.", "success");
            fetchDatos();
            closeEditModal();
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email: newUser.email,
            password: newUser.password,
            options: {
                data: {
                    nombre: newUser.nombre,
                    rol: newUser.rol
                }
            }
        });

        if (error) {
            notify("Error al crear usuario: " + error.message, "error");
        } else {
            notify(`¡Usuario creado exitosamente! Se ha enviado un correo de verificación a ${newUser.email}.`, "success");
            setNewUser({ nombre: '', email: '', password: '', rol: 'vendedor' });
            fetchDatos();
            closeAddModal();
        }
        setLoading(false);
    };

    const openAuditModal = (user) => {
        setUserToAudit(user);
        setIsAuditModalOpen(true);
    };

    const closeAuditModal = () => {
        gsap.to(auditOverlayRef.current, { opacity: 0, duration: 0.3, onComplete: () => setIsAuditModalOpen(false) });
    };

    useEffect(() => {
        if (isModalOpen) gsap.fromTo(modalRef.current, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3 });
    }, [isModalOpen]);

    useEffect(() => {
        if (isAddModalOpen) gsap.fromTo(addModalRef.current, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.3 });
    }, [isAddModalOpen]);

    useEffect(() => {
        if (isAuditModalOpen) {
            gsap.fromTo(auditOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(auditModalRef.current, { scale: 0.9, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" });
        }
    }, [isAuditModalOpen]);

    const closeEditModal = () => setIsModalOpen(false);
    const closeAddModal = () => setIsAddModalOpen(false);

    return (
        <div className="w-full space-y-6 pb-10 sm:px-4 animate-in fade-in duration-500">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
                        <Users className="text-[#3b82f6]" size={28} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1e2a4a] to-[#3b82f6]">Gestión de Personal</span>
                    </h2>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">Control de accesos, roles y auditoría de ventas por empleado.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full md:w-auto bg-[#3b82f6] text-white px-6 py-3.5 sm:py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5"
                >
                    <UserPlus size={18} /> Nuevo Acceso
                </button>
            </div>

            {/* VISTA MÓVIL (Tarjetas) / VISTA DESKTOP (Tabla) */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex flex-col justify-center items-center h-48 text-slate-400 space-y-4">
                        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* VISTA MÓVIL: Tarjetas */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {usuarios.map((u) => {
                                const ventasUsuario = pedidos.filter(p => p.vendedor_id === u.id);
                                const dineroIngresado = ventasUsuario.filter(p => p.estado === 'vendido' || p.estado === 'enviado').reduce((sum, p) => sum + (p.total || 0), 0);
                                const tieneCajaAbierta = turnosAbiertos.find(t => t.usuario_id === u.id);

                                return (
                                    <div key={u.id} className={`p-5 flex flex-col gap-4 ${u.estado === 'inactivo' ? 'bg-red-50/30' : 'bg-white'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm uppercase shrink-0 ${u.estado === 'inactivo' ? 'bg-red-100 text-red-500' : 'bg-[#f4f6f9] text-[#1e2a4a]'}`}>
                                                {u.nombre?.charAt(0) || 'U'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-[#1e2a4a] truncate pr-2">{u.nombre}</h3>
                                                    {u.estado === 'inactivo' && (
                                                        <span className="bg-red-100 text-red-600 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black shrink-0">Inactivo</span>
                                                    )}
                                                    {tieneCajaAbierta && (
                                                        <span className="bg-emerald-100 text-emerald-600 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black animate-pulse shrink-0">Caja Abierta</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-[6px] text-[9px] font-black uppercase tracking-widest ${u.rol === 'admin' ? 'bg-[#ec4899]/10 text-[#ec4899]' : u.rol === 'supervisor' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-slate-100 text-slate-600'}`}>
                                                    {u.rol}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center bg-[#f4f6f9]/50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Ventas Totales</p>
                                                <p className="font-black text-[#1e2a4a] text-sm">S/ {dineroIngresado.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Operaciones</p>
                                                <p className="font-bold text-[#ec4899] text-sm">{ventasUsuario.length}</p>
                                            </div>
                                        </div>

                                        {/* Botones de acción en Móvil */}
                                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-50">
                                            {tieneCajaAbierta && (
                                                <button onClick={() => handleCierreForzado(tieneCajaAbierta, u.nombre)} className="flex flex-col items-center gap-1 p-2 bg-orange-50 text-orange-500 rounded-xl active:bg-orange-500 active:text-white transition-colors">
                                                    <Lock size={18} />
                                                </button>
                                            )}
                                            <button onClick={() => openAuditModal(u)} className="flex flex-col items-center gap-1 p-2 bg-blue-50 text-[#3b82f6] rounded-xl active:bg-[#3b82f6] active:text-white transition-colors">
                                                <Receipt size={18} />
                                            </button>
                                            <button onClick={() => { setUserSelected(u); setIsModalOpen(true) }} className="flex flex-col items-center gap-1 p-2 bg-emerald-50 text-emerald-500 rounded-xl active:bg-emerald-500 active:text-white transition-colors">
                                                <Edit size={18} />
                                            </button>

                                            {u.estado === 'inactivo' ? (
                                                <button onClick={() => handleAccionAcceso(u)} className="flex flex-col items-center gap-1 p-2 bg-slate-100 text-slate-500 rounded-xl active:bg-slate-500 active:text-white transition-colors">
                                                    <CheckCircle2 size={18} />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleAccionAcceso(u)} className="flex flex-col items-center gap-1 p-2 bg-red-50 text-red-500 rounded-xl active:bg-red-500 active:text-white transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* VISTA DESKTOP: Tabla */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead>
                                    <tr className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest border-b border-slate-100">
                                        <th className="p-5 font-black">Usuario y Contacto</th>
                                        <th className="p-5 font-black">Nivel de Acceso</th>
                                        <th className="p-5 font-black flex items-center gap-1"><TrendingUp size={14} className="text-[#ec4899]" /> Rendimiento de Ventas</th>
                                        <th className="p-5 font-black"><Calendar size={14} className="inline mr-1 text-[#3b82f6]" /> Fecha de Ingreso</th>
                                        <th className="p-5 font-black text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {usuarios.map((u) => {
                                        const ventasUsuario = pedidos.filter(p => p.vendedor_id === u.id);
                                        const dineroIngresado = ventasUsuario.filter(p => p.estado === 'vendido' || p.estado === 'enviado').reduce((sum, p) => sum + (p.total || 0), 0);
                                        const tieneCajaAbierta = turnosAbiertos.find(t => t.usuario_id === u.id);

                                        return (
                                            <tr key={u.id} className={`transition-colors group ${u.estado === 'inactivo' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50/80'}`}>
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs uppercase shrink-0 transition-colors ${u.estado === 'inactivo' ? 'bg-red-100 text-red-500' : 'bg-[#f4f6f9] text-[#1e2a4a] group-hover:bg-[#ec4899] group-hover:text-white'}`}>
                                                            {u.nombre?.charAt(0) || 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-[#1e2a4a] flex items-center gap-2">
                                                                {u.nombre}
                                                                {u.estado === 'inactivo' && (
                                                                    <span className="bg-red-100 text-red-600 border border-red-200 text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black">Suspendido</span>
                                                                )}
                                                                {tieneCajaAbierta && (
                                                                    <span className="bg-emerald-100 text-emerald-600 border border-transparent text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full font-black animate-pulse">Caja Abierta</span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5 tracking-wider">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5">
                                                    <span className={`px-3 py-1.5 rounded-[8px] text-[10px] font-black uppercase tracking-widest border border-transparent ${u.rol === 'admin' ? 'bg-[#ec4899]/10 text-[#ec4899]' : u.rol === 'supervisor' ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : 'bg-[#f4f6f9] text-[#1e2a4a]'}`}>
                                                        {u.rol}
                                                    </span>
                                                </td>
                                                <td className="p-5">
                                                    <div className="font-black text-[#1e2a4a] text-sm">S/ {dineroIngresado.toFixed(2)}</div>
                                                    <div className="text-[10px] text-[#ec4899] font-bold mt-0.5 uppercase tracking-widest flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> {ventasUsuario.length} operaciones
                                                    </div>
                                                </td>
                                                <td className="p-5 text-slate-500 text-xs font-medium">{formatDate(u.created_at)}</td>
                                                <td className="p-5 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        {tieneCajaAbierta && (
                                                            <button onClick={() => handleCierreForzado(tieneCajaAbierta, u.nombre)} className="p-2.5 bg-[#f4f6f9] rounded-xl text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm" title="Forzar Cierre de Caja">
                                                                <Lock size={16} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => openAuditModal(u)} className="p-2.5 bg-[#f4f6f9] rounded-xl text-slate-500 hover:bg-[#3b82f6] hover:text-white transition-all shadow-sm" title="Auditar Ventas">
                                                            <Receipt size={16} />
                                                        </button>
                                                        <button onClick={() => { setUserSelected(u); setIsModalOpen(true) }} className="p-2.5 bg-[#f4f6f9] rounded-xl text-slate-500 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Editar Rol">
                                                            <Edit size={16} />
                                                        </button>
                                                        {u.estado === 'inactivo' ? (
                                                            <button onClick={() => handleAccionAcceso(u)} className="p-2.5 bg-[#f4f6f9] rounded-xl text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Reactivar Acceso">
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => handleAccionAcceso(u)} className="p-2.5 bg-[#f4f6f9] rounded-xl text-slate-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Suspender o Eliminar">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
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

            {/* MODAL NUEVO USUARIO (Mobile-First) */}
            {isAddModalOpen && (
                <div ref={addOverlayRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div ref={addModalRef} className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="w-full flex justify-center pb-4 sm:hidden"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] flex items-center gap-2"><UserPlus className="text-[#3b82f6]" /> Nuevo Acceso</h3>
                            <button onClick={closeAddModal} className="text-slate-400 hover:text-[#ec4899] hover:bg-[#ec4899]/10 p-2 rounded-full transition-colors hidden sm:block"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-4 overflow-y-auto hide-scrollbar pb-6 sm:pb-0">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nombre Completo</label>
                                <input type="text" placeholder="Ej: Ana López" required className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-bold p-4 rounded-2xl outline-none focus:bg-white focus:border-[#ec4899] transition-all" onChange={e => setNewUser({ ...newUser, nombre: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Correo Electrónico</label>
                                <input type="email" placeholder="correo@empresa.com" required className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-medium p-4 rounded-2xl outline-none focus:bg-white focus:border-[#ec4899] transition-all" onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Contraseña Temporal</label>
                                <input type="password" placeholder="Mínimo 6 caracteres" required minLength={6} className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-medium p-4 rounded-2xl outline-none focus:bg-white focus:border-[#ec4899] transition-all" onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nivel de Acceso (Rol)</label>
                                <select value={newUser.rol} className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-bold p-4 rounded-2xl outline-none focus:bg-white focus:border-[#ec4899] transition-all appearance-none" onChange={e => setNewUser({ ...newUser, rol: e.target.value })}>
                                    <option value="vendedor">Cajero / Vendedor</option>
                                    <option value="supervisor">Supervisor de Tienda</option>
                                    <option value="admin">Administrador General</option>
                                </select>
                            </div>
                            <button disabled={loading} className="w-full bg-[#3b82f6] text-white font-black py-4 rounded-2xl mt-4 uppercase text-xs tracking-widest shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-all disabled:opacity-50 hover:bg-blue-600">
                                {loading ? 'Creando...' : 'Confirmar Registro'}
                            </button>
                            <button type="button" onClick={closeAddModal} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest sm:hidden">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR ROL (Mobile-First) */}
            {isModalOpen && (
                <div ref={overlayRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div ref={modalRef} className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col">
                        <div className="w-full flex justify-center pb-4 sm:hidden"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1e2a4a] flex items-center gap-2"><Edit className="text-emerald-500" /> Editar Perfil</h3>
                            <button onClick={closeEditModal} className="text-slate-400 hover:text-emerald-500 p-2 hover:bg-emerald-50 rounded-full transition-colors hidden sm:block"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="space-y-4 pb-6 sm:pb-0">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nombre</label>
                                <input type="text" value={userSelected?.nombre || ''} className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-bold p-4 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 transition-all" onChange={e => setUserSelected({ ...userSelected, nombre: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Rol Operativo</label>
                                <select value={userSelected?.rol || 'vendedor'} className="w-full bg-[#f4f6f9] border border-transparent text-[#1e2a4a] font-bold p-4 rounded-2xl outline-none focus:bg-white focus:border-emerald-500 transition-all appearance-none" onChange={e => setUserSelected({ ...userSelected, rol: e.target.value })}>
                                    <option value="vendedor">Vendedor</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl mt-4 uppercase text-xs tracking-widest shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 transition-all hover:bg-emerald-600">Guardar Cambios</button>
                            <button type="button" onClick={closeEditModal} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest sm:hidden">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL AUDITORÍA DE VENTAS (Mobile-First) */}
            {isAuditModalOpen && userToAudit && (
                <div ref={auditOverlayRef} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div ref={auditModalRef} className="bg-white w-full max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="w-full flex justify-center pt-3 pb-1 bg-[#f4f6f9]/50 sm:hidden"><div className="w-12 h-1.5 bg-slate-200 rounded-full"></div></div>
                        <div className="p-5 sm:p-8 border-b border-slate-100 flex justify-between items-start sm:items-center bg-[#f4f6f9]/50">
                            <div>
                                <h3 className="text-xl font-black text-[#1e2a4a] flex items-center gap-2">
                                    <ShieldCheck className="text-[#3b82f6]" /> Auditoría Operativa
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Revisando historial de tickets de: <span className="font-bold text-[#1e2a4a]">{userToAudit.nombre}</span></p>
                            </div>
                            <button onClick={closeAuditModal} className="text-slate-400 hover:text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors p-2 rounded-full hidden sm:block"><X size={20} /></button>
                        </div>

                        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-white">
                            {pedidos.filter(p => p.vendedor_id === userToAudit.id).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <div className="w-16 h-16 bg-[#f4f6f9] rounded-full flex items-center justify-center mb-4"><Package size={32} className="opacity-50" /></div>
                                    <p className="text-sm font-bold text-center px-4">Este usuario no tiene operaciones registradas.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Lista Auditoría Móvil */}
                                    <div className="md:hidden space-y-3 pb-6">
                                        {pedidos.filter(p => p.vendedor_id === userToAudit.id).map(p => (
                                            <div key={p.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                                <div>
                                                    <p className="font-black text-[#1e2a4a] text-sm">#{p.ticket}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5 mb-2">{formatDate(p.created_at)}</p>
                                                    <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-black uppercase tracking-widest ${p.estado === 'vendido' || p.estado === 'enviado' ? 'text-emerald-600 bg-emerald-50' : p.estado === 'anulado' ? 'text-red-500 bg-red-50' : 'text-amber-600 bg-amber-50'}`}>
                                                        {p.estado}
                                                    </span>
                                                </div>
                                                <p className="font-black text-[#1e2a4a] text-base">S/ {p.total?.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Tabla Auditoría Desktop */}
                                    <div className="hidden md:block border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#f4f6f9]/50 text-[#1e2a4a] text-[10px] uppercase tracking-widest font-black border-b border-slate-100">
                                                <tr>
                                                    <th className="p-4">Ticket de Venta</th>
                                                    <th className="p-4">Fecha</th>
                                                    <th className="p-4 text-center">Estado</th>
                                                    <th className="p-4 text-right">Monto Procesado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {pedidos.filter(p => p.vendedor_id === userToAudit.id).map(p => (
                                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="p-4 font-black text-[#1e2a4a]">#{p.ticket}</td>
                                                        <td className="p-4 text-slate-500 text-xs">{formatDate(p.created_at)}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-2.5 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest ${p.estado === 'vendido' || p.estado === 'enviado' ? 'text-emerald-600 bg-emerald-50' : p.estado === 'anulado' ? 'text-red-500 bg-red-50' : 'text-amber-600 bg-amber-50'}`}>
                                                                {p.estado}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-black text-[#1e2a4a]">S/ {p.total?.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                            <button onClick={closeAuditModal} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest sm:hidden mt-2 border-t border-slate-100">Cerrar Auditoría</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}