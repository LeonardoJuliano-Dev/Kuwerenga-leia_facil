import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, MessageCircle, Mail } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [step, setStep] = useState<"options" | "phone" | "email" | "otp">("options");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [inputValue, setInputValue] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 1. Pedir o Código OTP ou Magic Link
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue) return;
    
    setLoading(true);
    setError("");

    try {
      if (method === "phone") {
        const fullPhone = `+258${inputValue}`;
        const { error } = await supabase.auth.signInWithOtp({
          phone: fullPhone,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: inputValue,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
      }
      
      setStep("otp");
    } catch (err: any) {
      console.error(err);
      if (err?.message?.toLowerCase().includes("rate limit") || err?.status === 429) {
        setError("Limite temporário de envio de e-mails atingido no Supabase. Aguarda alguns minutos ou usa o número de teste do WhatsApp / SMS.");
      } else {
        setError(err.message || "Erro ao processar o pedido.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Verificar o Código OTP (quando por telefone)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join("");
    if (token.length !== 6) return;

    setLoading(true);
    setError("");

    try {
      let authData;
      
      if (method === "phone") {
        const fullPhone = `+258${inputValue}`;
        const { data, error } = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: token,
          type: 'sms'
        });
        if (error) throw error;
        authData = data;
      } else {
        const { data, error } = await supabase.auth.verifyOtp({
          email: inputValue,
          token: token,
          type: 'email'
        });
        if (error) throw error;
        authData = data;
      }

      // Check if user has full_name filled
      const userId = authData.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .maybeSingle();

        if (!profile?.full_name || profile.full_name.trim() === "") {
          navigate("/setup-profile", { replace: true });
          return;
        }
      }

      // Sucesso!
      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError("Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  };

  // Gestão visual das caixas do OTP
  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Mover para a próxima caixa
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && index > 0 && otp[index] === "") {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const isOtpComplete = otp.every(digit => digit !== "");

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white p-6">
      
      {/* Header com botão Voltar */}
      {step !== "options" && (
        <header className="py-2">
          <button 
            onClick={() => setStep(step === "otp" ? method : "options")} 
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </header>
      )}

      {/* Conteúdo Principal */}
      <main className={`flex-1 flex flex-col max-w-sm mx-auto w-full ${step === "options" ? "justify-center" : "mt-8"}`}>
        
        {step === "options" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <BookOpen className="w-16 h-16 mb-6" />
            <h1 className="text-3xl font-bold mb-2">Leitura+</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-center">
              Entre para continuar
            </p>

            <div className="space-y-4 w-full">
              <button 
                onClick={() => { setMethod("phone"); setStep("phone"); setInputValue(""); setError(""); }} 
                className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 py-3.5 rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Continuar com WhatsApp / SMS
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">ou</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              </div>

              <button 
                onClick={() => { setMethod("email"); setStep("email"); setInputValue(""); setError(""); }}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 py-3.5 rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <Mail className="w-5 h-5" />
                Continuar com E-mail
              </button>
            </div>
          </div>
        )}

        {(step === "phone" || step === "email") && (
          <form onSubmit={handleRequestOtp} className="flex flex-col animate-in slide-in-from-right-8 duration-300">
            <h1 className="text-2xl font-bold mb-2">
              {method === "phone" ? "Digite seu número" : "Digite seu e-mail"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
              {method === "phone" 
                ? "Vamos enviar um código de verificação para o seu WhatsApp / SMS." 
                : "Vamos enviar um link de verificação seguro para o seu e-mail."}
            </p>

            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900">
                {error}
              </p>
            )}

            <div className="flex gap-3 mb-6">
              {method === "phone" && (
                <div className="w-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 flex items-center justify-center font-medium">
                  +258
                </div>
              )}
              <input
                type={method === "phone" ? "tel" : "email"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={method === "phone" ? "Número de telefone" : "nome@exemplo.com"}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || inputValue.length < 5}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading 
                ? "A processar..." 
                : (method === "email" ? "Verificar" : "Pedir código")}
            </button>
          </form>
        )}

        {step === "otp" && (
          <div className="flex flex-col animate-in slide-in-from-right-8 duration-300">
            <h1 className="text-2xl font-bold mb-2">
              {method === "phone" ? "Verifique o seu código" : "Verifique o seu e-mail"}
            </h1>
            
            {method === "phone" ? (
              <form onSubmit={handleVerifyOtp} className="flex flex-col">
                <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
                  Enviamos um código de 6 dígitos<br/>para <span className="font-semibold text-black dark:text-white">+258 {inputValue}</span>.
                </p>

                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

                <div className="flex justify-between gap-2 mb-8">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-12 h-14 text-center text-xl font-bold bg-white dark:bg-black border-2 border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isOtpComplete}
                  className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-4"
                >
                  {loading ? "A verificar..." : "Confirmar"}
                </button>
              </form>
            ) : (
              <div className="text-center mt-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Mail className="w-8 h-8 text-black dark:text-white" />
                </div>
                <h2 className="text-lg font-bold mb-2">Link de acesso enviado!</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed text-sm">
                  Enviamos um link de autenticação direta para <br/>
                  <span className="font-semibold text-black dark:text-white">{inputValue}</span>.<br/><br/>
                  Abre o e-mail no teu telemóvel ou computador e clica em <strong>"Sign in" / "Confirmar"</strong>. Irás regressar automaticamente autenticado!
                </p>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-500 text-left">
                  💡 <strong>Nota:</strong> Se demorar ou der limite excedido, verifica o lixo eletrónico (Spam) ou aguarda um instante.
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
