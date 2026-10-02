import { ArrowLeft, Search, Type, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";

export default function Reader() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white">
      
      {/* Top Navigation */}
      <header className="px-4 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-black z-10">
        <div className="flex items-center gap-4">
          <Link to="/library" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-semibold text-sm">O Poder do Hábito</span>
        </div>
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-300">
          <Search className="w-5 h-5" />
          <Type className="w-5 h-5" />
          <MoreVertical className="w-5 h-5" />
        </div>
      </header>

      {/* Main Reader Area */}
      <main className="flex-1 px-6 py-6 pb-24 relative overflow-hidden flex flex-col">
        <div className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
          <p className="mb-6">
            O hábito é uma cadeia de comportamentos, e para mudá-lo é preciso entender o que o dispara, o que o mantém e o que pode ser substituído.
          </p>
          
          {/* Selected text simulation with Popover */}
          <div className="relative mb-6">
            
            {/* Popover Menu (Mockup) */}
            <div className="absolute -top-12 left-0 right-0 flex justify-center z-20">
              <div className="bg-black dark:bg-gray-800 text-white rounded-lg flex items-center px-2 py-1 shadow-xl animate-in zoom-in duration-200">
                <button className="px-3 py-2 text-xs font-semibold border-r border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-700 rounded-l-md">Marcar</button>
                <button className="px-3 py-2 text-xs font-semibold border-r border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-700">Anotar</button>
                <button className="px-3 py-2 text-xs font-semibold border-r border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-700">Copiar</button>
                <button className="px-3 py-2 text-xs font-semibold hover:bg-gray-800 dark:hover:bg-gray-700 rounded-r-md">Comentar</button>
                {/* Small caret pointing down */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black dark:bg-gray-800 rotate-45"></div>
              </div>
            </div>

            <p className="bg-gray-200 dark:bg-gray-800 px-1 -mx-1 rounded">
              O hábito é uma cadeia cadeia de comportamentos, e para mudá-lo é preciso entender o que o dispara, o que o mantém e o que pode ser substituído.
            </p>
          </div>
          
          <p className="mb-6 opacity-40 blur-[1px]">
            Texto simulado para preencher o resto da página e dar a ilusão de um livro completo sendo renderizado no leitor. A leitura continua aqui embaixo.
          </p>
        </div>
      </main>

      {/* Bottom Progress Bar */}
      <footer className="fixed bottom-0 w-full bg-white dark:bg-black p-6 pb-safe">
        <div className="flex justify-between items-center mb-4 text-xs text-gray-500 font-medium">
          <span>Capítulo 7</span>
          <span>Página 87 de 245</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-800 rounded-full relative">
            <div className="absolute top-0 left-0 h-full bg-black dark:bg-white rounded-full w-[63%]"></div>
            {/* Scrubber thumb */}
            <div className="absolute top-1/2 -translate-y-1/2 left-[63%] w-3 h-3 bg-black dark:bg-white rounded-full shadow-sm -ml-1.5"></div>
          </div>
          <span className="text-xs font-medium">63%</span>
        </div>
      </footer>
    </div>
  );
}
