import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Menu, X, LogIn, LogOut, User, CalendarDays } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import AuthDialog from "@/components/AuthDialog";

export const Crest = ({ className = "h-9 w-9" }) => (
  <div className={`${className} relative flex items-center justify-center rounded-lg bg-white overflow-hidden ring-2 ring-white/20`}>
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
      <div className="bg-[#111827]" />
      <div className="bg-white" />
      <div className="bg-white" />
      <div className="bg-[#111827]" />
    </div>
    <Shield className="relative z-10 h-4 w-4 text-[#15803d]" strokeWidth={2.5} />
  </div>
);

export default function Header({ onNav }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { label: "Book a Pitch", target: "facilities", testId: "nav-link-facilities" },
    { label: "My Bookings", target: "my-bookings", testId: "nav-link-my-bookings" },
    { label: "Check Status", target: "status", testId: "nav-link-status" },
  ];

  const go = (t) => {
    setMenuOpen(false);
    onNav?.(t);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <button onClick={() => go("top")} className="flex items-center gap-3" data-testid="brand-home-btn">
            <div className="rounded-lg bg-[#111827] p-1.5">
              <Crest />
            </div>
            <div className="text-left leading-none">
              <div className="font-display text-xl font-extrabold tracking-wide text-[#111827]">
                WALTERSTOWN GFC
              </div>
              <div className="text-[10px] font-semibold tracking-[0.18em] text-[#15803d]">
                PITCH &amp; FACILITY BOOKINGS
              </div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <button
                key={l.target}
                data-testid={l.testId}
                onClick={() => go(l.target)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-[#111827] transition-colors"
              >
                {l.label}
              </button>
            ))}
            {user && user.role === "admin" && (
              <button
                data-testid="nav-link-admin"
                onClick={() => navigate("/admin")}
                className="px-3 py-2 text-sm font-semibold text-[#d97706] hover:text-[#b45309] transition-colors"
              >
                Admin Portal
              </button>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <User className="h-4 w-4" /> {user.name?.split(" ")[0]}
                </span>
                <Button variant="outline" size="sm" onClick={logout} data-testid="logout-btn">
                  <LogOut className="h-4 w-4 mr-1" /> Sign out
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setAuthOpen(true)}
                data-testid="open-auth-btn"
                className="bg-[#15803d] hover:bg-[#166534] text-white"
              >
                <LogIn className="h-4 w-4 mr-1" /> Sign In / Join
              </Button>
            )}
            <Button
              onClick={() => go("facilities")}
              className="bg-[#111827] hover:bg-[#1f2937] text-white"
              data-testid="nav-cta-quick-book"
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Check Availability
            </Button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen((o) => !o)} data-testid="mobile-menu-btn">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {links.map((l) => (
            <button
              key={l.target}
              data-testid={`m-${l.testId}`}
              onClick={() => go(l.target)}
              className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-100"
            >
              {l.label}
            </button>
          ))}
          {user && user.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-[#d97706] rounded-lg hover:bg-amber-50"
            >
              Admin Portal
            </button>
          )}
          <div className="pt-2">
            {user ? (
              <Button variant="outline" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            ) : (
              <Button className="w-full bg-[#15803d] text-white" onClick={() => setAuthOpen(true)}>
                <LogIn className="h-4 w-4 mr-1" /> Sign In / Join
              </Button>
            )}
          </div>
        </div>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  );
}
