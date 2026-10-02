import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight, User } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function SetupProfile() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is actually authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      // If already has name, go to home
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.full_name && data.full_name.trim().length > 0) {
            navigate("/home", { replace: true });
          }
        });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Por favor, introduz pelo menos 2 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada.");

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: trimmed,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) throw upsertError;

      // Navigate to Home
      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao guardar o teu nome.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white p-6">
      <main className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-in fade-in duration-300">
        <div className="w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center mb-6 shadow-md">
          <BookOpen className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Como queres ser chamado?
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
          Conta-nos o teu nome para personalizarmos o teu leitor e as tuas estatísticas de leitura.
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="O teu nome completo ou alcunha"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-12 pr-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
              autoFocus
              maxLength={50}
            />
          </div>

          <button
            type="submit"
            disabled={loading || name.trim().length < 2}
            className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              "A guardar..."
            ) : (
              <>
                <span>Continuar para a Leitura</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
