// src/pages/donor/DonorDashboard.tsx
import { useEffect, useState } from 'react';
import { 
  User as LucideUser , 
  MapPin, 
  Calendar, 
  Droplet, 
  Phone, 
  Mail, 
  Heart 
} from 'lucide-react';
import { User, useAuth } from '../../contexts/AuthContext'; 

function DonorDashboard() {
  const { user } = useAuth();
  const [donorData, setDonorData] = useState<User | null>(null);

  useEffect(() => {
    if (user) {
      const safeUserData: User = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        bloodType: user.bloodType,
        lastDonation: user.lastDonation,
        isAvailable: user.isAvailable,
        location: user.location,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        totalDonations: user.totalDonations,
        role: user.role
      };

      setDonorData(safeUserData);
    }
  }, [user]);

  const formatDate = (date?: Date | string) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const calculateAge = (dob?: string | Date) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const getDonationEligibility = () => {
    if (!donorData?.lastDonation) return 'First-time Donor';
    
    const lastDonationDate = new Date(donorData.lastDonation);
    const today = new Date();
    const monthsSinceLastDonation = (today.getFullYear() - lastDonationDate.getFullYear()) * 12 + 
      (today.getMonth() - lastDonationDate.getMonth());
    
    return monthsSinceLastDonation >= 3 ? 'Eligible to Donate' : 'Not Eligible (Recent Donation)';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-3 gap-8">
        {/* Profile Section */}
        <div className="md:col-span-1 bg-white shadow-lg rounded-lg p-6 text-center transition-transform transform hover:scale-105 duration-300 ease-in-out">
          <div className="mb-6">
            {donorData?.photoURL ? (
              <img 
                src={donorData.photoURL} 
                alt="Profile" 
                className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-red-500 transition-transform transform hover:scale-110 duration-300 ease-in-out"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?background=dc2626&color=fff&name=${encodeURIComponent(donorData?.displayName || 'Donor')}`;
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center">
                <LucideUser  className="w-16 h-16 text-gray-500" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2 text-red-600">{donorData?.displayName || 'Donor Name'}</h2>
          <p className="text-gray-600 mb-4">{donorData?.email}</p>

          <div className="space-y-4">
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <Droplet className="mr-2 text-red-500" size={20} />
              <span>{donorData?.bloodType || 'Blood Type Not Set'}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <Heart className="mr-2 text-red-500" size={20} />
              <span>{ getDonationEligibility()}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <Calendar className="mr-2 text-red-500" size={20} />
              <span>Last Donation: {formatDate(donorData?.lastDonation)}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <MapPin className="mr-2 text-red-500" size={20} />
              <span>{donorData?.location?.city || 'Location Not Set'}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <Phone className="mr-2 text-red-500" size={20} />
              <span>{donorData?.phoneNumber || 'Phone Not Set'}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <Mail className="mr-2 text-red-500" size={20} />
              <span>{donorData?.email || 'Email Not Set'}</span>
            </div>
            <div className="flex items-center justify-center transition-all duration-300 hover:text-red-500">
              <span>Age: {calculateAge(donorData?.dateOfBirth)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DonorDashboard;