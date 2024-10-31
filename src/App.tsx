import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import { DonorLogin } from './pages/auth/DonorLogin';
import HospitalLogin from './pages/auth/HospitalLogin';
import NgoLogin from './pages/auth/NgoLogin';
import AdminLogin from './pages/auth/AdminLogin';
import { AuthProvider } from './contexts/AuthContext';
import FindDonors from './pages/FindDonors';
import RequestBlood from './pages/RequestBlood';
import About from './pages/About';
import Contact from './pages/Contact';
import DonorRegister from './pages/DonorRegister';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/donors" element={<FindDonors />} />
              <Route path="/request-blood" element={<RequestBlood />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/donor/register" element={<DonorRegister />} />
              <Route path="/donor/login" element={<DonorLogin />} />
              <Route path="/hospital/login" element={<HospitalLogin />} />
              <Route path="/ngo/login" element={<NgoLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              {/* 404 Route - Must be last */}
              <Route path="*" element={<NotFound />} />
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