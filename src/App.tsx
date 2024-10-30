import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import DonorLogin from './pages/auth/DonorLogin';
import HospitalLogin from './pages/auth/HospitalLogin';
import NgoLogin from './pages/auth/NgoLogin';
import AdminLogin from './pages/auth/AdminLogin';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/donor/login" element={<DonorLogin />} />
              <Route path="/hospital/login" element={<HospitalLogin />} />
              <Route path="/ngo/login" element={<NgoLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
            </Routes>
          </main>
          <Footer />
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;