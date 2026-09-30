import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AuthDialog({ open, onOpenChange }) {
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({ name: "", email: "", phone: "", password: "" });

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(loginData.email, loginData.password);
      toast.success(`Welcome back, ${u.name?.split(" ")[0]}!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await register(regData);
      toast.success(`Account created — fáilte, ${u.name?.split(" ")[0]}!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="auth-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Club Members
          </DialogTitle>
          <DialogDescription>
            Sign in to track your bookings, or create an account. You can also book as a guest.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="login">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Join</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={doLogin} className="space-y-3 pt-2">
              <div>
                <Label htmlFor="li-email">Email</Label>
                <Input id="li-email" type="email" required data-testid="login-email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="li-pass">Password</Label>
                <Input id="li-pass" type="password" required data-testid="login-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} data-testid="login-submit"
                className="w-full bg-[#15803d] hover:bg-[#166534] text-white">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={doRegister} className="space-y-3 pt-2">
              <div>
                <Label htmlFor="r-name">Full name</Label>
                <Input id="r-name" required data-testid="register-name"
                  value={regData.name}
                  onChange={(e) => setRegData({ ...regData, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="r-email">Email</Label>
                <Input id="r-email" type="email" required data-testid="register-email"
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="r-phone">Phone</Label>
                <Input id="r-phone" data-testid="register-phone"
                  value={regData.phone}
                  onChange={(e) => setRegData({ ...regData, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="r-pass">Password</Label>
                <Input id="r-pass" type="password" required minLength={6} data-testid="register-password"
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} data-testid="register-submit"
                className="w-full bg-[#15803d] hover:bg-[#166534] text-white">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
