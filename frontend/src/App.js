import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import BookingApp from "@/pages/BookingApp";
import AdminDashboard from "@/pages/AdminDashboard";
import { PaymentSuccess, PaymentCancel } from "@/pages/PaymentResult";
import PayPage from "@/pages/PayPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
        <Routes>
          <Route path="/" element={<BookingApp />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/pay/:id" element={<PayPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
