import { Plus, MoreVertical } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { Link } from "react-router-dom";

export default function Library() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white pb-24 relative">
      <header className="px-6 pt-12 pb-2 bg-white dark:bg-black sticky top-0 z-10">
        <h1 className="text-2xl font-bold mb-6">Minha Biblioteca</h1>
        
        {/* Stats / Tabs */}
        <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-1">A ler</span>
            <span className="font-bold">8</span>
            <div className="w-full h-0.5 bg-black dark:bg-white mt-3 absolute bottom-0 w-[40px]"></div>
          </div>
          <div className="flex flex-col items-center opacity-50">
            <span className="text-xs text-gray-500 mb-1">Lendo</span>
            <span className="font-bold">3</span>
          </div>
          <div className="flex flex-col items-center opacity-50">
            <span className="text-xs text-gray-500 mb-1">Terminados</span>
            <span className="font-bold">27</span>
          </div>
          <div className="flex flex-col items-center opacity-50">
            <span className="text-xs text-gray-500 mb-1">Salvos</span>
            <span className="font-bold">18</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pt-6 space-y-6">
        
        {/* Item 1 */}
        <Link to="/reader" className="flex gap-4 items-center group">
          <div className="w-16 h-24 bg-black rounded-md flex-shrink-0 flex items-center justify-center">
            <span className="text-white text-[10px] text-center font-serif px-1">O Poder do Hábito</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm leading-tight mb-1">O Poder do Hábito</h3>
            <p className="text-xs text-gray-500 mb-2">Charles Duhigg</p>
            <p className="text-[10px] text-gray-400">Capítulo 7 • 63%</p>
          </div>
          <button className="p-2 -mr-2 text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </Link>

        {/* Item 2 */}
        <Link to="/reader" className="flex gap-4 items-center group">
          <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md flex-shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-center font-serif px-1 font-bold">Sapiens</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm leading-tight mb-1">Sapiens</h3>
            <p className="text-xs text-gray-500 mb-2">Yuval Noah Harari</p>
            <p className="text-[10px] text-gray-400">Capítulo 2 • 21%</p>
          </div>
          <button className="p-2 -mr-2 text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </Link>

        {/* Item 3 */}
        <Link to="/reader" className="flex gap-4 items-center group">
          <div className="w-16 h-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md flex-shrink-0 flex items-center justify-center">
             <span className="text-[10px] text-center font-serif px-1 font-bold">Hábitos<br/>Atômicos</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm leading-tight mb-1">Hábitos Atômicos</h3>
            <p className="text-xs text-gray-500 mb-2">James Clear</p>
            <p className="text-[10px] text-gray-400">Capítulo 1 • 5%</p>
          </div>
          <button className="p-2 -mr-2 text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </Link>

        {/* Item 4 */}
        <Link to="/reader" className="flex gap-4 items-center group opacity-70">
          <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md flex-shrink-0 flex items-center justify-center">
             <span className="text-[10px] text-center font-serif px-1 font-bold">A Psicologia<br/>do Dinheiro</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm leading-tight mb-1">A Psicologia do Dinheiro</h3>
            <p className="text-xs text-gray-500 mb-2">Morgan Housel</p>
            <p className="text-[10px] text-black dark:text-white font-medium">Concluído</p>
          </div>
          <button className="p-2 -mr-2 text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </Link>

      </main>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 w-14 h-14 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform">
        <Plus className="w-6 h-6" />
      </button>

      <BottomNav />
    </div>
  );
}
