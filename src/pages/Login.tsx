import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, MessageCircle, Mail } from "lucide-react";

export default function Login() {
  const [step, setStep] = useState<"options" | "phone" | "otp">("options");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const navigate = useNavigate();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length > 5) setStep("otp");
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
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

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOtpComplete) {
      navigate("/home");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white p-6">
      
      {/* Header */}
      {step !== "options" && (
        <header className="py-2">
          <button onClick={() => setStep(step === "otp" ? "phone" : "options")} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col max-w-sm mx-auto w-full ${step === "options" ? "justify-center" : "mt-8"}`}>
        
        {step === "options" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <BookOpen className="w-16 h-16 mb-6" />
            <h1 className="text-3xl font-bold mb-2">Leitura+</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-center">
              Entre para continuar
            </p>

            <div className="space-y-4 w-full">
              <button className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 py-3.5 rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuar com Google
              </button>
              
              <button onClick={() => setStep("phone")} className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 py-3.5 rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <MessageCircle className="w-5 h-5" />
                Continuar com WhatsApp
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">ou</span>
                <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
              </div>

              <button className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 py-3.5 rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <Mail className="w-5 h-5" />
                Continuar com e-mail
              </button>
            </div>

            <p className="mt-12 text-center text-xs text-gray-500">
              Ao continuar, você concorda com nossos<br/>
              <a href="#" className="underline">Termos de Uso</a> e <a href="#" className="underline">Política de Privacidade</a>.
            </p>
          </div>
        )}

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col animate-in slide-in-from-right-8 duration-300">
            <h1 className="text-2xl font-bold mb-2">Digite seu número</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
              Vamos enviar um código de verificação<br/>para o seu WhatsApp.
            </p>

            <div className="flex gap-3 mb-6">
              <div className="w-24 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 flex items-center justify-center font-medium">
                +258
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Número de telefone"
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={phone.length < 5}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              Pedir código
            </button>

            <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed px-4">
              Certifique-se de que o número está correto<br/>e que o WhatsApp está ativo.
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col animate-in slide-in-from-right-8 duration-300">
            <h1 className="text-2xl font-bold mb-2">Verifique seu WhatsApp</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
              Enviamos um código de 6 dígitos<br/>para <span className="font-semibold text-black dark:text-white">+258 {phone}</span>.
            </p>

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

            <button type="button" className="text-gray-500 text-sm font-medium mb-6 text-center hover:text-black dark:hover:text-white transition-colors">
              Reenviar código (00:45)
            </button>

            <button
              type="submit"
              disabled={!isOtpComplete}
              className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50 mb-4"
            >
              Confirmar
            </button>

            <button type="button" onClick={() => setStep("phone")} className="text-gray-500 text-sm font-medium text-center hover:text-black dark:hover:text-white transition-colors">
              Alterar número
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
