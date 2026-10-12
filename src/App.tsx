import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import SetupProfile from "./pages/SetupProfile";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Library from "./pages/Library";
import Profile from "./pages/Profile";
import Reader from "./pages/Reader";
import DonateBook from "./pages/DonateBook";
import BookDetails from "./pages/BookDetails";
import Community from "./pages/Community";
import ClubDetails from "./pages/ClubDetails";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import { initThemeListener } from "./lib/theme";

import { isGuestMode, disableGuestMode } from "./lib/guestMode";

function AuthRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkUserStatus = async (user: any) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.full_name || profile.full_name.trim().length === 0) {
        // Se o utilizador autenticou via Google OAuth, utiliza o nome já fornecido
        const oauthName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (oauthName && oauthName.trim().length > 0) {
          await supabase.from("profiles").upsert({
            id: user.id,
            full_name: oauthName.trim(),
            avatar_url: user.user_metadata?.avatar_url || null,
            updated_at: new Date().toISOString(),
          });
          if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/setup-profile") {
            navigate("/home", { replace: true });
          }
          return;
        }

        if (location.pathname !== "/setup-profile") {
          navigate("/setup-profile", { replace: true });
        }
      } else {
        // User is logged in and has completed profile
        if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/setup-profile") {
          navigate("/home", { replace: true });
        }
      }
    } catch (e) {
      console.error("Erro ao verificar perfil:", e);
      if (location.pathname === "/" || location.pathname === "/login") {
        navigate("/home", { replace: true });
      }
    }
  };

  useEffect(() => {
    // 0. Inicializa ouvinte de tema
    const cleanupTheme = initThemeListener();

    // 1. Check existing session in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        disableGuestMode();
        checkUserStatus(session.user).finally(() => setCheckingAuth(false));
      } else if (isGuestMode()) {
        // Convidado autenticado localmente
        if (location.pathname === "/setup-profile") {
          navigate("/home", { replace: true });
        }
        setCheckingAuth(false);
      } else {
        // Se não tiver sessão nem for convidado
        const publicRoutes = ["/", "/login"];
        if (!publicRoutes.includes(location.pathname)) {
          navigate("/", { replace: true });
        }
        setCheckingAuth(false);
      }
    });

    // 2. Listen for auth changes (Google OAuth, Magic Link, OTP verify, Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        disableGuestMode();
        await checkUserStatus(session.user);
      } else if (event === "SIGNED_OUT") {
        disableGuestMode();
        navigate("/", { replace: true });
      }
    });

    return () => {
      cleanupTheme();
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup-profile" element={<SetupProfile />} />
      <Route path="/home" element={<Home />} />
      <Route path="/explore" element={<Explore />} />
      <Route path="/library" element={<Library />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/reader" element={<Reader />} />
      <Route path="/donate-book" element={<DonateBook />} />
      <Route path="/book/:id" element={<BookDetails />} />
      <Route path="/community" element={<Community />} />
      <Route path="/club/:id" element={<ClubDetails />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/support" element={<Support />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthRouter />
    </BrowserRouter>
  );
}

export default App;
