import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, BookHeart, Users, User } from "lucide-react";

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const getClassName = (activePath: string) => 
    `flex flex-col items-center gap-1 transition-colors touch-target justify-center ${path === activePath ? "text-black dark:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`;

  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-black border-t border-gray-200 dark:border-gray-900 z-50">
      <div className="app-container px-4 sm:px-6 py-2 pb-safe flex items-center justify-between sm:justify-center sm:gap-12 md:gap-16">
        <Link to="/home" className={getClassName("/home")}>
          <div className="w-6 h-6 flex items-center justify-center">
            <BookOpen className={`w-5 h-5 ${path === "/home" ? "fill-current" : ""}`} />
          </div>
          <span className="text-[10px] font-medium">Início</span>
        </Link>
        <Link to="/explore" className={getClassName("/explore")}>
          <div className="w-6 h-6 flex items-center justify-center">
            <Search className={`w-5 h-5 ${path === "/explore" ? "stroke-[3]" : ""}`} />
          </div>
          <span className="text-[10px] font-medium">Explorar</span>
        </Link>
        <Link to="/library" className={getClassName("/library")}>
          <div className="w-6 h-6 flex items-center justify-center">
            <BookHeart className={`w-5 h-5 ${path === "/library" ? "fill-current" : ""}`} />
          </div>
          <span className="text-[10px] font-medium">Biblioteca</span>
        </Link>
        <Link to="/community" className={getClassName("/community")}>
          <div className="w-6 h-6 flex items-center justify-center">
            <Users className={`w-5 h-5 ${path === "/community" ? "fill-current" : ""}`} />
          </div>
          <span className="text-[10px] font-medium">Comunidade</span>
        </Link>
        <Link to="/profile" className={getClassName("/profile")}>
          <div className="w-6 h-6 flex items-center justify-center">
            <User className={`w-5 h-5 ${path === "/profile" ? "fill-current" : ""}`} />
          </div>
          <span className="text-[10px] font-medium">Perfil</span>
        </Link>
      </div>
    </nav>
  );
}
