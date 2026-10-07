import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Library, Users, CircleUser, Plus } from "lucide-react";

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    {
      path: "/home",
      label: "Início",
      icon: Home,
    },
    {
      path: "/explore",
      label: "Explorar",
      icon: Compass,
    },
    {
      path: "/library",
      label: "Biblioteca",
      icon: Library,
    },
    {
      path: "/community",
      label: "Comunidade",
      icon: Users,
    },
    {
      path: "/profile",
      label: "Perfil",
      icon: CircleUser,
    },
  ];

  return (
    <>
      {/* ─── NAVEGAÇÃO DESKTOP (Fixa no Topo em ecrãs médios e grandes) ─── */}
      <header className="hidden md:block fixed top-0 left-0 right-0 h-16 bg-white/85 dark:bg-black/85 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60 z-50 transition-colors">
        <div className="app-container h-full px-6 flex items-center justify-between">
          {/* Marca / Logo */}
          <Link to="/home" className="flex items-center gap-3 group">
            <img
              src="/favicon.svg"
              alt="KUWERENGA"
              className="w-8 h-8 rounded-xl shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight leading-none">KUWERENGA+</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">
                Leia Fácil
              </span>
            </div>
          </Link>

          {/* Menus de Navegação Desktop com cápsula flutuante */}
          <nav className="flex items-center gap-1.5 bg-gray-100/70 dark:bg-gray-900/70 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 backdrop-blur-md">
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs transition-all duration-200 ${
                    isActive
                      ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs scale-[1.02]"
                      : "text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:text-black dark:hover:text-white font-medium"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Ações Desktop */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/donate-book"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold shadow-xs hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Doar Livro</span>
            </Link>
            <Link
              to="/profile"
              className={`p-2 rounded-xl border transition-all ${
                currentPath === "/profile"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/10 text-black dark:text-white"
                  : "border-gray-200 dark:border-gray-800 text-gray-500 hover:text-black dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-700"
              }`}
              title="Meu Perfil"
            >
              <CircleUser className="w-4.5 h-4.5 stroke-[1.8]" />
            </Link>
          </div>
        </div>
      </header>

      {/* ─── NAVEGAÇÃO MOBILE (Fixa no Rodapé com Glassmorphism e Pílulas Ativas) ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 z-50 shadow-[0_-8px_30px_rgb(0_0_0_/_4%)] dark:shadow-[0_-8px_30px_rgb(0_0_0_/_40%)] transition-colors">
        <div className="app-container px-2 sm:px-4 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 touch-target select-none group relative transition-transform duration-150 active:scale-90"
              >
                {/* Cápsula do Ícone com micro-animação */}
                <div
                  className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-all duration-200 ${
                    isActive
                      ? "bg-black/8 dark:bg-white/14 text-black dark:text-white scale-105"
                      : "text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-all duration-200 ${
                      isActive ? "stroke-[2.3]" : "stroke-[1.8] group-hover:scale-105"
                    }`}
                  />
                </div>

                {/* Texto / Etiqueta da Aba */}
                <span
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
                    isActive
                      ? "font-bold text-black dark:text-white"
                      : "font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                  }`}
                >
                  {item.label}
                </span>

                {/* Indicador de Precisão (Ponto ativo) */}
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 transition-all duration-200 ${
                    isActive
                      ? "bg-black dark:bg-white scale-100 opacity-100"
                      : "bg-transparent scale-0 opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
