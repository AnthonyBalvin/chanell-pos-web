import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Creamos el contexto
const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Revisar si ya hay alguien logueado al abrir la página
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                fetchProfileRole(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // 2. Quedarse escuchando si alguien hace Login o Logout
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
                fetchProfileRole(session.user.id);
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Función para ir a buscar si es admin o vendedor a la tabla "perfiles"
    const fetchProfileRole = async (userId) => {
        const { data, error } = await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', userId)
            .single();

        if (data) {
            setRole(data.rol);
        } else {
            console.error("Error obteniendo rol:", error);
        }
        setLoading(false);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

// Un hook personalizado para usarlo fácilmente en otras pantallas
export const useAuth = () => useContext(AuthContext);