import { Search, BookHeart, Users, Compass, User, MoreHorizontal, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-20">
      
      {/* Header */}
      <header className="px-6 pt-12 pb-4 bg-white dark:bg-black sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Início</h1>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        
        {/* Search */}
        <div className="px-6 mb-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Pesquisar livros, autores..." 
              className="w-full pl-12 pr-4 py-3.5 bg-gray-100 dark:bg-gray-900 rounded-2xl focus:outline-none text-sm font-medium"
            />
          </div>
        </div>

        {/* Continuar a ler */}
        <section className="px-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Continuar a ler</h2>
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex gap-4">
              <div className="w-20 h-28 bg-black rounded-md flex-shrink-0 flex items-center justify-center">
                 {/* Mockup Book Cover */}
                 <div className="text-white text-xs text-center px-1">
                    <span className="opacity-50 text-[8px] uppercase tracking-widest block mb-1">Livro</span>
                    <span className="font-serif">O Poder do Hábito</span>
                 </div>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="font-bold text-sm leading-tight mb-1">O Poder do Hábito</h3>
                <p className="text-xs text-gray-500 mb-2">Charles Duhigg</p>
                <p className="text-xs text-gray-400 mb-3">Capítulo 7 • 63%</p>
                
                <div className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full mb-3">
                  <div className="h-full bg-black dark:bg-white rounded-full w-[63%]" />
                </div>
              </div>
            </div>
            
            <button className="w-full mt-2 bg-black dark:bg-white text-white dark:text-black py-3 rounded-xl text-sm font-semibold">
              Continuar
            </button>
          </div>
        </section>

        {/* Quick Actions (Round Buttons) */}
        <section className="px-6 mb-10 flex justify-between">
          <div className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-sm">
              <Search className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Pesquisar</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-sm">
              <BookHeart className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Doar livro</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Clubes</span>
          </div>
          <div className="flex flex-col items-center gap-2 cursor-pointer">
            <div className="w-14 h-14 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full flex items-center justify-center shadow-sm">
              <MoreHorizontal className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Mais</span>
          </div>
        </section>

        {/* Em Destaque */}
        <section className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Em destaque</h2>
            <button className="text-xs text-gray-500 font-medium">Ver todos</button>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
            
            {/* Book 1 */}
            <div className="w-28 flex-shrink-0 snap-start">
              <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 rounded-md mb-2 flex flex-col items-center justify-center p-2 text-center border border-gray-200 dark:border-gray-700">
                 <span className="font-serif text-sm font-bold leading-tight">Sapiens</span>
                 <span className="text-[8px] mt-1 text-gray-500">Yuval Noah Harari</span>
              </div>
              <h4 className="text-xs font-bold leading-tight line-clamp-1">Sapiens</h4>
              <p className="text-[10px] text-gray-500 truncate">Yuval Noah Harari</p>
            </div>

            {/* Book 2 */}
            <div className="w-28 flex-shrink-0 snap-start">
              <div className="w-full h-40 bg-gray-50 dark:bg-gray-900 rounded-md mb-2 flex flex-col items-center justify-center p-2 text-center border border-gray-200 dark:border-gray-700">
                 <span className="font-serif text-sm font-bold leading-tight">Hábitos<br/>Atômicos</span>
              </div>
              <h4 className="text-xs font-bold leading-tight line-clamp-1">Hábitos Atômicos</h4>
              <p className="text-[10px] text-gray-500 truncate">James Clear</p>
            </div>

            {/* Book 3 */}
            <div className="w-28 flex-shrink-0 snap-start">
              <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 rounded-md mb-2 flex flex-col items-center justify-center p-2 text-center border border-gray-200 dark:border-gray-700">
                 <span className="font-serif text-sm font-bold leading-tight">A Psicologia<br/>do Dinheiro</span>
              </div>
              <h4 className="text-xs font-bold leading-tight line-clamp-1">A Psicologia...</h4>
              <p className="text-[10px] text-gray-500 truncate">Morgan Housel</p>
            </div>

          </div>
        </section>

      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
