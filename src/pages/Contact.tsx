import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle, Clock, Headphones } from 'lucide-react';
import toast from 'react-hot-toast';

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent successfully! We\'ll get back to you soon.');
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="absolute top-20 right-20 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-6 py-2 bg-red-100 rounded-full mb-8">
              <MessageCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-semibold">Contact Us</span>
            </div>

            <h1 className="text-6xl font-extrabold mb-6">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                We're Here to Help
              </span>
            </h1>

            <p className="text-xl text-gray-600 leading-relaxed">
              Have questions? Need support? Our team is available 24/7 to assist you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-red-50 to-white p-8 rounded-2xl border-2 border-red-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Phone</h3>
              <p className="text-gray-600 mb-2">Available 24/7</p>
              <a href="tel:+911800123456" className="text-red-600 font-semibold hover:text-red-700">
                +91 1800-123-456
              </a>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white p-8 rounded-2xl border-2 border-red-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Email</h3>
              <p className="text-gray-600 mb-2">Response in 24 hours</p>
              <a href="mailto:support@bloodhub.in" className="text-red-600 font-semibold hover:text-red-700">
                support@bloodhub.in
              </a>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white p-8 rounded-2xl border-2 border-red-100 text-center hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Office</h3>
              <p className="text-gray-600 mb-2">Visit us</p>
              <p className="text-red-600 font-semibold">Mumbai, Maharashtra</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
              <div className="grid md:grid-cols-2">
                {/* Form */}
                <div className="p-12">
                  <h2 className="text-3xl font-bold mb-6">
                    <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                      Send us a Message
                    </span>
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                        placeholder="+91 9876543210"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors"
                      >
                        <option value="">Select a subject</option>
                        <option value="general">General Inquiry</option>
                        <option value="donor">Donor Support</option>
                        <option value="hospital">Hospital Partnership</option>
                        <option value="emergency">Emergency Request</option>
                        <option value="technical">Technical Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors resize-none"
                        placeholder="How can we help you?"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center"
                    >
                      <Send className="w-5 h-5 mr-2" />
                      Send Message
                    </button>
                  </form>
                </div>

                {/* Info Sidebar */}
                <div className="bg-gradient-to-br from-red-600 to-red-800 p-12 text-white flex flex-col justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-6">Why Contact Us?</h3>
                    <div className="space-y-6">
                      <div className="flex items-start">
                        <Headphones className="w-6 h-6 mr-4 flex-shrink-0 mt-1" />
                        <div>
                          <h4 className="font-semibold mb-1">24/7 Support</h4>
                          <p className="text-sm text-white/80">Our team is always available to help you</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <Clock className="w-6 h-6 mr-4 flex-shrink-0 mt-1" />
                        <div>
                          <h4 className="font-semibold mb-1">Quick Response</h4>
                          <p className="text-sm text-white/80">We typically respond within 2 hours</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <MessageCircle className="w-6 h-6 mr-4 flex-shrink-0 mt-1" />
                        <div>
                          <h4 className="font-semibold mb-1">Expert Guidance</h4>
                          <p className="text-sm text-white/80">Get help from blood donation experts</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-white/20">
                    <p className="text-sm text-white/80 mb-4">Follow us on social media</p>
                    <div className="flex space-x-4">
                      <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                        <span className="sr-only">Facebook</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                      <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                        <span className="sr-only">Twitter</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
                      </a>
                      <a href="#" className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                        <span className="sr-only">Instagram</span>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/></svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Frequently Asked Questions
              </span>
            </h2>
            <p className="text-gray-600 mb-12">Can't find your answer? Feel free to contact us!</p>
            <div className="space-y-4 text-left">
              {[
                { q: "What are your operating hours?", a: "We provide 24/7 emergency support for urgent blood requests" },
                { q: "How quickly can I expect a response?", a: "Typically within 2 hours during business hours, and within 6 hours for overnight inquiries" },
                { q: "Do you have physical offices?", a: "Our headquarters is in Mumbai, but we operate digitally across India" }
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 p-6 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                  <p className="text-gray-600">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Contact;
