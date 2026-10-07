import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, BookHeart, Users, User, Plus } from "lucide-react";

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const getMobileClassName = (activePath: string) => 
    `flex flex-col items-center gap-1 transition-colors touch-target justify-center ${
      path === activePath ? "text-black dark:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"
    }`;

  const getDesktopClassName = (activePath: string) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
      path === activePath
        ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-black dark:hover:text-white"
    }`;

  return (
    <>
      {/* ─── NAVEGAÇÃO DESKTOP (Fixa no Topo em ecrãs médios e grandes) ─── */}
      <header className="hidden md:block fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-900 z-50">
        <div className="app-container h-full px-6 flex items-center justify-between">
          {/* Marca / Logo */}
          <Link to="/home" className="flex items-center gap-3 group">
            <img src="/favicon.svg" alt="KUWERENGA" className="w-8 h-8 rounded-xl shadow-xs group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-none">KUWERENGA</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">Leia Fácil</span>
            </div>
          </Link>

          {/* Menus de Navegação */}
          <nav className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/60 p-1 rounded-2xl border border-gray-100 dark:border-gray-800">
            <Link to="/home" className={getDesktopClassName("/home")}>
              <BookOpen className="w-4 h-4" />
              <span>Início</span>
            </Link>
            <Link to="/explore" className={getDesktopClassName("/explore")}>
              <Search className="w-4 h-4" />
              <span>Explorar</span>
            </Link>
            <Link to="/library" className={getDesktopClassName("/library")}>
              <BookHeart className="w-4 h-4" />
              <span>Biblioteca</span>
            </Link>
            <Link to="/community" className={getDesktopClassName("/community")}>
              <Users className="w-4 h-4" />
              <span>Comunidade</span>
            </Link>
          </nav>

          {/* Ações Desktop */}
          <div className="flex items-center gap-3">
            <Link
              to="/donate-book"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Doar Livro</span>
            </Link>
            <Link
              to="/profile"
              className={`p-2 rounded-xl border transition-colors ${
                path === "/profile"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/5 text-black dark:text-white"
                  : "border-gray-200 dark:border-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
              }`}
              title="Meu Perfil"
            >
              <User className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── NAVEGAÇÃO MOBILE (Fixa no Rodapé em telemóveis) ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-900 z-50">
        <div className="app-container px-4 sm:px-6 py-2 pb-safe flex items-center justify-between">
          <Link to="/home" className={getMobileClassName("/home")}>
            <div className="w-6 h-6 flex items-center justify-center">
              <BookOpen className={`w-5 h-5 ${path === "/home" ? "fill-current" : ""}`} />
            </div>
            <span className="text-[10px] font-medium">Início</span>
          </Link>
          <Link to="/explore" className={getMobileClassName("/explore")}>
            <div className="w-6 h-6 flex items-center justify-center">
              <Search className={`w-5 h-5 ${path === "/explore" ? "stroke-[3]" : ""}`} />
            </div>
            <span className="text-[10px] font-medium">Explorar</span>
          </Link>
          <Link to="/library" className={getMobileClassName("/library")}>
            <div className="w-6 h-6 flex items-center justify-center">
              <BookHeart className={`w-5 h-5 ${path === "/library" ? "fill-current" : ""}`} />
            </div>
            <span className="text-[10px] font-medium">Biblioteca</span>
          </Link>
          <Link to="/community" className={getMobileClassName("/community")}>
            <div className="w-6 h-6 flex items-center justify-center">
              <Users className={`w-5 h-5 ${path === "/community" ? "fill-current" : ""}`} />
            </div>
            <span className="text-[10px] font-medium">Comunidade</span>
          </Link>
          <Link to="/profile" className={getMobileClassName("/profile")}>
            <div className="w-6 h-6 flex items-center justify-center">
              <User className={`w-5 h-5 ${path === "/profile" ? "fill-current" : ""}`} />
            </div>
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
