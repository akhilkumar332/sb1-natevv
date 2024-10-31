function Contact() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
      <p className="mb-4">Get in touch with us:</p>
      <ul className="list-disc list-inside">
        <li>Email: contact@lifeflow.org</li>
        <li>Phone: +1 (555) 123-4567</li>
        <li>Address: 123 Life Street, Health City</li>
      </ul>
      {/* Add a contact form here if desired */}
    </div>
  );
}

export default Contact;