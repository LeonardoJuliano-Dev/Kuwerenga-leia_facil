import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, ExternalLink, HelpCircle, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import BottomNav from "../components/BottomNav";

export default function Support() {
  const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/DoFCh34EJMN9FZ0qceNBL1?s=cl&p=a&mlu=4&ilr=4";

  const faqs = [
    {
      q: "Como descarregar e ler livros sem ligação à Internet?",
      a: "Ao abrir qualquer livro no leitor digital do Kuwerenga, o ficheiro é automaticamente guardado no armazenamento do teu navegador ou dispositivo. Podes aceder-lhe e continuar a leitura a qualquer momento, mesmo sem ligação."
    },
    {
      q: "Como registar livros físicos que já li?",
      a: "Na tela da Biblioteca, clica em 'Registar Lido' e seleciona a opção 'Livro Físico ou Externo'. Podes introduzir o título, autor, número de páginas e a tua avaliação pessoal."
    },
    {
      q: "Como doar um livro para a biblioteca comunitária?",
      a: "Clica em 'Doar Livro' na barra superior ou na página inicial. Podes fazer o upload de ficheiros em formato PDF ou EPUB de domínio público ou com autorização para partilha."
    },
    {
      q: "Como funcionam os Clubes de Leitura?",
      a: "Na secção de Clubes, podes aderir a grupos existentes ou criar o teu próprio clube para debater obras, acompanhar metas mensais de leitura e partilhar opiniões com outros membros."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black text-black dark:text-white pb-24 md:pb-12 md:pt-16">
      
      {/* Top Bar */}
      <header className="px-4 sm:px-6 pt-safe sticky top-0 z-10 bg-white/95 dark:bg-black/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-900">
        <div className="app-container pt-6 sm:pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
              title="Voltar ao Perfil"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold leading-tight">Suporte & Ajuda</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Atendimento ao leitor e comunidade Kuwerenga
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 app-container space-y-6">
        
        {/* Cartão de Acesso ao Grupo de WhatsApp Oficial */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-xs">
              <MessageCircle className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                Canal Oficial
              </span>
              <h2 className="text-base sm:text-lg font-bold mt-1">
                Comunidade & Suporte no WhatsApp
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Junta-te ao nosso grupo comunitário para tirar dúvidas, relatar problemas, sugerir melhorias e interagir com a equipa de desenvolvimento e outros leitores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 border-y border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Atendimento comunitário ativo</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Ambiente moderado e seguro</span>
            </div>
          </div>

          <div className="pt-4">
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Entrar no Grupo de Suporte</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>
        </div>

        {/* Perguntas Frequentes (FAQ) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Perguntas Frequentes
            </h3>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {faqs.map((faq, index) => (
              <details key={index} className="group py-3.5 cursor-pointer">
                <summary className="font-semibold text-xs sm:text-sm flex items-center justify-between list-none">
                  <span>{faq.q}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 shrink-0 ml-2" />
                </summary>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed pr-4">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
