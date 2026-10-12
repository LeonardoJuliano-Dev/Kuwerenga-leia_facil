import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { enableGuestMode } from "../lib/guestMode";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Erro no login com Google:", err);
      if (err?.message?.includes("provider is not enabled") || err?.message?.includes("Unsupported provider")) {
        setError("O login com Google ainda precisa de ser ativado no painel do Supabase (Sign In / Providers).");
      } else {
        setError(err?.message || "Não foi possível iniciar sessão com Google.");
      }
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    enableGuestMode();
    navigate("/home", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white p-6 sm:p-8 justify-center items-center">
      
      {/* Conteúdo Centralizado */}
      <main className="flex-1 flex flex-col justify-center items-center max-w-sm sm:max-w-md mx-auto w-full py-6">
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 w-full text-center">
          
          {/* Logótipo */}
          <div className="w-20 h-20 mb-4 rounded-3xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl">
            <svg viewBox="0 0 100 100" className="w-12 h-12" fill="none">
              <line x1="30" y1="24" x2="30" y2="76" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" />
              <path d="M70 25 L42 50 L70 75" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold mb-1 tracking-tight">
            KUWERENGA+
          </h1>
          <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">
            Leia Fácil
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs text-sm leading-relaxed">
            Acede à tua biblioteca pessoal, clubes de leitura e sincroniza o teu progresso.
          </p>

          <div className="space-y-4 w-full">
            {error && (
              <p className="text-red-500 text-xs mb-2 bg-red-50 dark:bg-red-950/40 p-3.5 rounded-2xl border border-red-200 dark:border-red-900 text-center leading-relaxed">
                {error}
              </p>
            )}

            {/* Opção 1: Continuar com Google */}
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white py-4 rounded-2xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
              <span>Continuar com Google</span>
            </button>

            {/* Divisória para Convidado */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              <span className="flex-shrink-0 mx-3 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                ou entra sem conta
              </span>
              <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
            </div>

            {/* Opção 2: Entrar como Convidado */}
            <button 
              onClick={handleGuestLogin}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-semibold text-sm border border-dashed border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-all bg-gray-50/70 dark:bg-gray-900/60 active:scale-95"
            >
              <UserCheck className="w-4 h-4 text-gray-500" />
              <span>Entrar como Convidado</span>
            </button>
          </div>

          <p className="mt-8 text-[11px] text-gray-400 leading-relaxed max-w-xs">
            Ao continuar, concordas com a leitura partilhada e os termos comunitários do Kuwerenga+.
          </p>
        </div>
      </main>
    </div>
  );
}
