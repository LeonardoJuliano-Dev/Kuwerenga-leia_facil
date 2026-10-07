import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Settings, BookOpen, Bookmark, AlignLeft, MessageSquare, Users, LogOut } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const [userName, setUserName] = useState<string>("Leitor");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const menuItems = [
    { icon: BookOpen, label: "Livros", count: "" },
    { icon: AlignLeft, label: "Anotações", count: "" },
    { icon: Bookmark, label: "Marcações", count: "" },
    { icon: MessageSquare, label: "Comentários", count: "" },
    { icon: Users, label: "Clubes", count: "" },
  ];

  useEffect(() => {
    async function loadProfile() {
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
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao terminar sessão:", err);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24">
      <header className="px-4 sm:px-6 pt-safe bg-white dark:bg-black">
        <div className="app-container pt-6 sm:pt-8 pb-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
          <UserIcon className="w-10 h-10 text-gray-400 mt-2" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{loading ? "A carregar..." : userName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{userEmail || "Leitor Leitura+"}</p>
        </div>
        </div>
      </header>

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
            <button key={i} className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              <div className="flex items-center gap-4">
                <item.icon className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-700" />
            </button>
          ))}
          
          <div className="h-2 bg-gray-50 dark:bg-black"></div>
          
          <button className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
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
              <span className="font-medium text-sm">Terminar Sessão</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-40" />
          </button>
        </div>
      </main>

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
