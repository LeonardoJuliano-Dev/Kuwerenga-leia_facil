import { useState } from "react";
import { BookOpen, MonitorSmartphone, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step === 3) {
      navigate("/login");
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-6 bg-white dark:bg-black text-black dark:text-white justify-between">
      {/* Dynamic Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center mt-12">
        {step === 0 && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <img src="/favicon.svg" alt="KUWERENGA" className="w-24 h-24 mb-5 rounded-3xl shadow-sm" />
            <h1 className="text-3xl font-bold mb-1 tracking-tight">KUWERENGA</h1>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Leia Fácil</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Mais do que livros,<br/>o seu universo de leitura offline.</p>
          </div>
        )}
        
        {step === 1 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-300">
            {/* Mockup image representation */}
            <div className="w-56 h-48 mb-8 flex items-end justify-center relative">
               <div className="w-32 h-40 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg absolute left-0 bottom-0 shadow-md"></div>
               <div className="w-28 h-36 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg absolute right-4 bottom-2 shadow-lg flex items-center justify-center">
                 <MonitorSmartphone className="w-12 h-12 text-gray-500" />
               </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Todos os seus livros.<br/>Num só lugar.</h2>
            <p className="text-gray-500 dark:text-gray-400 px-4">
              Tenha acesso a milhares de livros em PDF e EPUB, organize sua biblioteca e leia onde quiser.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-300">
            <div className="w-56 h-48 mb-8 flex items-end justify-center relative">
               <div className="w-24 h-40 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg absolute left-4 bottom-0 shadow-md flex items-center justify-center">
                 <MonitorSmartphone className="w-10 h-10 text-gray-400" />
               </div>
               <div className="w-24 h-32 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg absolute right-4 bottom-0 shadow-lg flex flex-col justify-evenly px-4">
                 <div className="w-full h-2 bg-gray-400 rounded-full"></div>
                 <div className="w-3/4 h-2 bg-gray-400 rounded-full"></div>
                 <div className="w-full h-2 bg-gray-400 rounded-full"></div>
               </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Leia onde estiver.</h2>
            <p className="text-gray-500 dark:text-gray-400 px-4">
              Faça marcações, anotações e acompanhe seu progresso, tudo dentro do app.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-300">
            <div className="w-56 h-48 mb-8 flex items-end justify-center relative">
               <Users className="w-32 h-32 text-gray-300 dark:text-gray-700 absolute bottom-0" />
               <Users className="w-24 h-24 text-gray-500 dark:text-gray-400 absolute bottom-0 right-4" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Leia sozinho ou<br/>acompanhado.</h2>
            <p className="text-gray-500 dark:text-gray-400 px-4">
              Participe de clubes de leitura, converse sobre livros e compartilhe ideias.
            </p>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center pb-8">
        {step > 0 && (
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-2 rounded-full transition-all ${step === i ? "w-6 bg-black dark:bg-white" : "w-2 bg-gray-200 dark:bg-gray-800"}`} />
            ))}
          </div>
        )}
        
        <button
          onClick={handleNext}
          className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform"
        >
          {step === 0 ? "Começar" : step === 3 ? "Começar" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
