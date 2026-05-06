import { useEffect, useRef, useState } from 'react';
import { Shield, Eye, EyeOff, ArrowLeft, MailCheck, ShieldAlert, Fingerprint, LockKeyhole, Cpu } from 'lucide-react';
import gsap from 'gsap';
import { supabase } from '../lib/supabase';
import { useChanellUI } from '../context/UIContext';

export default function Login() {
    const { notify } = useChanellUI();
    const containerRef = useRef(null);
    const formRef = useRef(null);
    const contentLeftRef = useRef(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);

    const [isRecovering, setIsRecovering] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoveryStep, setRecoveryStep] = useState('input');

    // Animación de entrada inicial con GSAP
    useEffect(() => {
        const tl = gsap.timeline();
        if (window.innerWidth >= 1024) {
            tl.fromTo(contentLeftRef.current,
                { opacity: 0, x: -30 },
                { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }
            );
        }
        tl.fromTo(containerRef.current,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
            "-=0.4"
        );
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Email not confirmed")) {
                notify("Acción Requerida: Cuenta no verificada. Por favor revisa tu bandeja de entrada o Spam.", "info");
            } else {
                notify("Error al iniciar sesión: Credenciales incorrectas.", "error");
            }
            setLoading(false);
        } else {
            const userRole = data.user?.user_metadata?.rol;
            window.location.href = userRole === 'admin' ? '/admin' : '/vendedor';
        }
    };

    const getMaskedEmail = (mail) => {
        if (!mail || !mail.includes('@')) return mail;
        const [name, domain] = mail.split('@');
        const maskedName = name.length > 2 ? name.substring(0, 2) + '*'.repeat(name.length - 2) : name;
        return `${maskedName}@${domain}`;
    };

    const handleRecovery = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        setLoading(false);
        if (error) {
            notify("Hubo un error: " + error.message, "error");
        } else {
            setRecoveryStep('success');
        }
    };

    return (
        <div className="relative flex flex-col lg:flex-row w-full min-h-screen bg-slate-50 font-sans overflow-hidden">

            {/* --------------------------------------------------------
                PANEL AZUL (Izquierdo en PC, Superior en Móvil)
            --------------------------------------------------------- */}
            <div
                className={`relative lg:absolute top-0 w-full lg:w-1/2 min-h-[30vh] lg:h-full bg-gradient-to-br from-[#1e2a4a] to-[#0f172a] flex-col justify-center lg:justify-between p-8 sm:p-12 lg:p-16 z-20 shadow-2xl transition-transform duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] flex ${isRecovering ? 'lg:translate-x-full' : 'lg:left-0'}`}
            >
                {/* Patrones Tecnológicos de Fondo */}
                <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden flex items-center justify-center">
                    <Fingerprint size={800} strokeWidth={0.5} className="absolute -left-1/4 text-white opacity-20" />
                    <Cpu size={500} strokeWidth={0.5} className="absolute -right-1/4 top-1/4 text-white opacity-20 rotate-12" />
                </div>

                <div ref={contentLeftRef} className="relative z-10 flex flex-col justify-center h-full gap-6 transition-all duration-500 max-w-md mx-auto lg:mx-0">
                    <div className="flex items-center gap-3 text-white mb-2">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                            <Shield size={24} className="text-[#ec4899]" />
                        </div>
                        <span className="text-xl font-black tracking-widest uppercase">Chanell Tech</span>
                    </div>

                    {!isRecovering ? (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                            <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
                                Portal de <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#ec4899]">
                                    Gestión ERP.
                                </span>
                            </h1>
                            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-4 font-medium">
                                Acceso restringido. Módulo central de inteligencia de negocios, facturación e inventario en tiempo real.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-500">
                            <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
                                Protocolo de <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-400">
                                    Seguridad.
                                </span>
                            </h1>
                            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mt-4 font-medium">
                                Sigue las instrucciones para restablecer tus credenciales de acceso administrativo de forma encriptada.
                            </p>
                        </div>
                    )}
                </div>

                <div className="relative z-10 text-slate-400/60 text-xs font-bold uppercase tracking-widest hidden lg:block">
                    © {new Date().getFullYear()} Noven Software — V 2.0
                </div>
            </div>

            {/* --------------------------------------------------------
                PANEL BLANCO (Derecho en PC, Inferior en Móvil)
            --------------------------------------------------------- */}
            <div
                className={`relative lg:absolute top-0 w-full lg:w-1/2 flex-1 lg:h-full flex items-center justify-center p-6 sm:p-12 lg:p-24 bg-white z-10 transition-transform duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${isRecovering ? 'lg:left-0' : 'lg:right-0'} rounded-t-[40px] lg:rounded-none -mt-10 lg:mt-0 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] lg:shadow-none`}
            >
                <div className="w-full max-w-sm lg:max-w-md relative pt-6 lg:pt-0" ref={containerRef}>

                    {/* VISTA 1: LOGIN NORMAL */}
                    {!isRecovering && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="mb-10 text-center lg:text-left">
                                <h2 className="text-2xl sm:text-3xl font-black text-[#1e2a4a] mb-2 tracking-tight">Iniciar Sesión</h2>
                                <p className="text-slate-500 text-sm font-medium">Ingresa tus credenciales corporativas.</p>
                            </div>

                            <form ref={formRef} onSubmit={handleLogin} className="space-y-5">
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl px-5 py-4 text-[#1e2a4a] text-sm font-bold focus:outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                            placeholder="admin@chanell.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl pl-5 pr-12 py-4 text-[#1e2a4a] text-sm font-bold focus:outline-none focus:bg-white focus:border-[#ec4899] focus:ring-4 focus:ring-[#ec4899]/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#ec4899] p-1 transition-colors"
                                            tabIndex="-1"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center justify-center w-5 h-5">
                                            <input
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-lg cursor-pointer checked:bg-[#1e2a4a] checked:border-[#1e2a4a] transition-all"
                                            />
                                            <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 group-hover:text-[#1e2a4a] transition-colors">Recordarme</span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => { setIsRecovering(true); setRecoveryStep('input'); }}
                                        className="text-xs font-black text-slate-400 hover:text-[#ec4899] transition-colors uppercase tracking-wider"
                                    >
                                        ¿Olvidó su clave?
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-[#1e2a4a] text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center hover:bg-black transition-all disabled:opacity-70 mt-8 shadow-[0_10px_20px_rgba(30,42,74,0.2)] hover:-translate-y-0.5"
                                >
                                    {loading ? 'Autenticando...' : 'Acceder al Sistema'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* VISTA 2: RECUPERAR CONTRASEÑA */}
                    {isRecovering && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <button
                                onClick={() => setIsRecovering(false)}
                                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-[#1e2a4a] uppercase tracking-widest mb-8 transition-colors"
                            >
                                <ArrowLeft size={14} /> Retornar
                            </button>

                            {recoveryStep === 'input' ? (
                                <>
                                    <div className="mb-10 text-center lg:text-left">
                                        <h2 className="text-2xl sm:text-3xl font-black text-[#1e2a4a] mb-2 tracking-tight">Recuperación</h2>
                                        <p className="text-slate-500 text-sm font-medium">Enviaremos un token seguro a tu buzón corporativo.</p>
                                    </div>

                                    <form onSubmit={handleRecovery} className="space-y-6">
                                        <div className="space-y-1.5 relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    value={recoveryEmail}
                                                    onChange={(e) => setRecoveryEmail(e.target.value)}
                                                    className="w-full bg-[#f4f6f9] border border-transparent rounded-2xl px-5 py-4 text-[#1e2a4a] text-sm font-bold focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all placeholder:text-slate-400 placeholder:font-medium"
                                                    placeholder="usuario@chanell.com"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl flex items-center justify-center hover:bg-amber-600 transition-all disabled:opacity-70 shadow-[0_10px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5"
                                        >
                                            {loading ? 'Generando token...' : 'Solicitar Acceso'}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center py-6 animate-in zoom-in duration-500">
                                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-xl shadow-emerald-500/20">
                                        <MailCheck size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-[#1e2a4a] mb-3">Enlace Desplegado</h2>
                                    <p className="text-slate-500 text-sm leading-relaxed font-medium">
                                        Hemos enviado las instrucciones al buzón de:<br />
                                        <span className="font-black text-[#1e2a4a] block mt-2 text-lg tracking-tight bg-slate-50 py-2 rounded-xl border border-slate-100">
                                            {getMaskedEmail(recoveryEmail)}
                                        </span>
                                    </p>
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-6">Protocolo de seguridad: Revisa la carpeta Spam.</p>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}