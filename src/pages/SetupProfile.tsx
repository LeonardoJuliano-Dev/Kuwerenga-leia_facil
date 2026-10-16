import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ArrowRight, User, AtSign } from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateDefaultUsername } from "../lib/profileService";

export default function SetupProfile() {
  const [step, setStep] = useState<"name" | "username">("name");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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

      // If already has name AND username, go to home
      supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (
            data?.full_name &&
            data.full_name.trim().length > 0 &&
            data?.username &&
            data.username.trim().length > 0
          ) {
            navigate("/home", { replace: true });
          } else if (data?.full_name && data.full_name.trim().length > 0) {
            // Has name but no username → go directly to username step
            setName(data.full_name.trim());
            setStep("username");
            // Auto-generate a suggestion
            setUsername(
              generateDefaultUsername(data.full_name.trim(), session.user.email || "")
            );
          }
        });
    });
  }, [navigate]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Por favor, introduz pelo menos 2 caracteres.");
      return;
    }
    setError("");
    // Generate a default username suggestion from the name
    supabase.auth.getUser().then(({ data: { user } }) => {
      const suggestion = generateDefaultUsername(trimmed, user?.email || "");
      setUsername(suggestion);
      setStep("username");
    });
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      setError("Escolhe um username com pelo menos 2 caracteres.");
      return;
    }

    // Ensure it starts with @
    if (!cleanUsername.startsWith("@")) {
      cleanUsername = `@${cleanUsername}`;
    }

    // Validate: only letters, numbers, dots, underscores after @
    const afterAt = cleanUsername.slice(1);
    if (!/^[a-zA-Z0-9._]+$/.test(afterAt)) {
      setError("O username só pode conter letras, números, pontos e underscores.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada.");

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: name.trim(),
        username: cleanUsername,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      // Navigate to Home
      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao guardar o teu perfil.");
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

        {/* ─── PASSO 1: NOME ─── */}
        {step === "name" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Bem-vindo ao Kuwerenga+
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
              Primeiro, diz-nos o teu nome completo ou alcunha para
              personalizarmos a tua experiência de leitura.
            </p>

            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900">
                {error}
              </p>
            )}

            <form onSubmit={handleNameSubmit} className="space-y-4">
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
                disabled={name.trim().length < 2}
                className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>Continuar</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </>
        )}

        {/* ─── PASSO 2: USERNAME ─── */}
        {step === "username" && (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Como queres ser chamado?
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2 leading-relaxed">
              Escolhe um nome de utilizador único. É assim que os outros leitores
              te vão encontrar na comunidade.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
              Sugestão baseada no teu nome:{" "}
              <span className="font-semibold text-black dark:text-white">
                {username}
              </span>
            </p>

            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900">
                {error}
              </p>
            )}

            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div className="relative">
                <AtSign className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username.startsWith("@") ? username.slice(1) : username}
                  onChange={(e) => {
                    const val = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9._]/g, "");
                    setUsername(`@${val}`);
                    if (error) setError("");
                  }}
                  placeholder="o.teu.username"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl pl-12 pr-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
                  autoFocus
                  maxLength={30}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep("name");
                    setError("");
                  }}
                  className="flex-1 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-semibold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    username.replace("@", "").trim().length < 2
                  }
                  className="flex-[2] bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? (
                    "A guardar..."
                  ) : (
                    <>
                      <span>Começar a Ler</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Indicador de progresso */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <span
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step === "name"
                ? "w-6 bg-black dark:bg-white"
                : "w-1.5 bg-gray-200 dark:bg-gray-800"
            }`}
          />
          <span
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step === "username"
                ? "w-6 bg-black dark:bg-white"
                : "w-1.5 bg-gray-200 dark:bg-gray-800"
            }`}
          />
        </div>
      </main>
    </div>
  );
}
