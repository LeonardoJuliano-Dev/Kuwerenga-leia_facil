import { Search, Filter, Heart, Briefcase, GraduationCap, Activity, Monitor, History } from "lucide-react";
import BottomNav from "../components/BottomNav";

export default function Explore() {
  const categories = [
    { name: "Romance", icon: Heart },
    { name: "História", icon: History },
    { name: "Negócios", icon: Briefcase },
    { name: "Educação", icon: GraduationCap },
    { name: "Saúde", icon: Activity },
    { name: "Tecnologia", icon: Monitor },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24">
      <header className="px-6 pt-12 pb-4 bg-white dark:bg-black sticky top-0 z-10">
        <h1 className="text-2xl font-bold mb-4">Explorar</h1>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Pesquisar livros, autores..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-2xl focus:outline-none text-sm font-medium"
            />
          </div>
          <button className="w-12 h-[52px] bg-gray-100 dark:bg-gray-900 rounded-2xl flex items-center justify-center">
             <Filter className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Pills */}
        <div className="px-6 py-4 flex gap-3 overflow-x-auto no-scrollbar">
          <button className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-semibold whitespace-nowrap">Todos</button>
          <button className="px-5 py-2 bg-gray-100 dark:bg-gray-900 rounded-full text-sm font-medium whitespace-nowrap">PDF</button>
          <button className="px-5 py-2 bg-gray-100 dark:bg-gray-900 rounded-full text-sm font-medium whitespace-nowrap">EPUB</button>
          <button className="px-5 py-2 bg-gray-100 dark:bg-gray-900 rounded-full text-sm font-medium whitespace-nowrap">Gratuitos</button>
        </div>

        {/* Categories */}
        <section className="px-6 mb-8 mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Categorias</h2>
            <button className="text-xs text-gray-500 font-medium">Ver todas</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat, i) => (
              <button key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
                <cat.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-semibold">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Most Popular */}
        <section className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Mais populares</h2>
            <button className="text-xs text-gray-500 font-medium">Ver todos</button>
          </div>
          <div className="space-y-4">
            {/* List item 1 */}
            <div className="flex gap-4">
              <div className="w-16 h-24 bg-black rounded-md flex items-center justify-center">
                 <span className="text-white text-[10px] text-center font-serif px-1">O Poder do Hábito</span>
              </div>
              <div className="flex-1 flex flex-col justify-center border-b border-gray-100 dark:border-gray-900 pb-4">
                <h3 className="font-bold text-sm leading-tight mb-1">O Poder do Hábito</h3>
                <p className="text-xs text-gray-500 mb-2">Charles Duhigg</p>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <span>★ 4.7</span>
                  <span className="text-gray-400 font-normal">(892)</span>
                </div>
              </div>
            </div>
            
            {/* List item 2 */}
            <div className="flex gap-4">
              <div className="w-16 h-24 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md flex items-center justify-center">
                 <span className="text-[10px] text-center font-serif px-1 font-bold">Sapiens</span>
              </div>
              <div className="flex-1 flex flex-col justify-center border-b border-gray-100 dark:border-gray-900 pb-4">
                <h3 className="font-bold text-sm leading-tight mb-1">Sapiens</h3>
                <p className="text-xs text-gray-500 mb-2">Yuval Noah Harari</p>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <span>★ 4.8</span>
                  <span className="text-gray-400 font-normal">(1.2k)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
