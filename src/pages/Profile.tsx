import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Settings, BookOpen, Bookmark, AlignLeft, MessageSquare, Users, LogOut, Sparkles, ArrowRight } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";
import { isGuestMode, disableGuestMode } from "../lib/guestMode";
import GuestRestrictionModal from "../components/GuestRestrictionModal";

export default function Profile() {
  const [userName, setUserName] = useState<string>("Leitor");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState<{
    isOpen: boolean;
    feature: "notes" | "highlights" | "bookmarks" | "community" | "donate" | "general";
  }>({
    isOpen: false,
    feature: "general"
  });
  const navigate = useNavigate();

  const menuItems = [
    { icon: BookOpen, label: "Livros", feature: "general" as const },
    { icon: AlignLeft, label: "Anotações", feature: "notes" as const },
    { icon: Bookmark, label: "Marcações", feature: "bookmarks" as const },
    { icon: MessageSquare, label: "Comentários", feature: "community" as const },
    { icon: Users, label: "Clubes", feature: "community" as const },
  ];

  useEffect(() => {
    async function loadProfile() {
      if (isGuestMode()) {
        setIsGuest(true);
        setUserName("Leitor Convidado");
        setUserEmail("Sessão temporária no dispositivo");
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserEmail(user.email || user.phone || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      } catch (err) {
        console.error("Erro ao carregar perfil:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleLogout = async () => {
    try {
      if (isGuest) {
        disableGuestMode();
        navigate("/", { replace: true });
        return;
      }
      await supabase.auth.signOut();
      disableGuestMode();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao terminar sessão:", err);
    }
  };

  const handleMenuItemClick = (item: typeof menuItems[0]) => {
    if (isGuest && item.feature !== "general") {
      setRestrictionModal({ isOpen: true, feature: item.feature });
      return;
    }
    if (item.label === "Livros") navigate("/library");
    if (item.label === "Clubes") navigate("/community");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black">
        <div className="app-container pt-6 sm:pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
              <UserIcon className="w-10 h-10 text-gray-400 mt-2" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{loading ? "A carregar..." : userName}</h1>
                {isGuest && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                    Convidado
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{userEmail || "Leitor Kuwerenga"}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Banner de Upgrade para Visitantes */}
      {isGuest && (
        <div className="px-4 sm:px-6 py-2 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-900">
          <div className="app-container">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Desbloqueia Todos os Recursos</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 max-w-md leading-relaxed">
                  Cria uma conta gratuita para guardar anotações, sincronizar o progresso de leitura e participar nos clubes com outros leitores.
                </p>
              </div>
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold active:scale-95 transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                <span>Criar Conta Grátis</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* Stats Row */}
        <div className="px-4 sm:px-6 py-6 bg-white dark:bg-black mb-2 border-t border-gray-100 dark:border-gray-900">
          <div className="app-container flex justify-between sm:justify-start sm:gap-16">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">0</span>
              <span className="text-xs text-gray-500 mt-1">Livros</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">0</span>
              <span className="text-xs text-gray-500 mt-1">Em leitura</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">0h</span>
              <span className="text-xs text-gray-500 mt-1">De leitura</span>
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="bg-white dark:bg-black app-container">
          {menuItems.map((item, i) => (
            <button 
              key={i} 
              onClick={() => handleMenuItemClick(item)}
              className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-4">
                <item.icon className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-700" />
            </button>
          ))}
          
          <div className="h-2 bg-gray-50 dark:bg-black"></div>
          
          <button 
            onClick={() => {
              if (isGuest) {
                setRestrictionModal({ isOpen: true, feature: "general" });
              }
            }}
            className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Settings className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-sm">Configurações</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-700" />
          </button>

          <button 
            onClick={handleLogout}
            className="w-full px-6 py-4 flex items-center justify-between text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <div className="flex items-center gap-4">
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">
                {isGuest ? "Sair do Modo Convidado" : "Terminar Sessão"}
              </span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-40" />
          </button>
        </div>
      </main>

      {/* Modal de Restrições para Convidados */}
      <GuestRestrictionModal
        isOpen={restrictionModal.isOpen}
        feature={restrictionModal.feature}
        onClose={() => setRestrictionModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <BottomNav />
    </div>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}
