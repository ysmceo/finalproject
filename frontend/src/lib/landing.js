function assetPath(name) {
  return encodeURI(`/images/${name}`);
}

export const salonContact = {
  address: "24 Kfarm Estate, Ikeja, Lagos State",
  phone: "07036939125",
  email: "okontaysm@gmail.com",
  whatsapp: "https://wa.me/2347036939125"
};

export const landingNav = [
  { label: "Services", href: "#services" },
  { label: "Products", href: "#products" },
  { label: "Gallery", href: "#gallery" },
  { label: "Team", href: "#team" },
  { label: "Contact", href: "#contact" }
];

export const heroStats = [
  { label: "Happy clients", value: "12k+" },
  { label: "Years experience", value: "15+" },
  { label: "Premium services", value: "8+" }
];

export const heroTrust = [
  "Certified stylists",
  "Hygienic tools",
  "Secure payments",
  "Lagos based team"
];

export const ribbonItems = [
  {
    title: "Professional service",
    description: "Experienced stylists, thoughtful consultations, and warm in-salon care."
  },
  {
    title: "Transparent pricing",
    description: "Clear totals for services, add-ons, products, and delivery before checkout."
  },
  {
    title: "Live follow-up",
    description: "Dedicated booking and order tracking without cluttering the landing page."
  }
];

export const heroBackdropImages = [
  assetPath("p1.webp"),
  assetPath("p6 styling.jpg"),
  assetPath("p5 relaxation services.jpg")
];

export const sectionBackdrops = {
  ceo: [assetPath("ysmceo.jpeg"), assetPath("ysmwife.jpeg"), assetPath("p6 styling.jpg")],
  services: [assetPath("p1.webp"), assetPath("p2 hair color.jpg"), assetPath("p5 relaxation services.jpg")],
  products: [assetPath("premium wig.jpeg"), assetPath("hair cream.jpeg"), assetPath("prefume.jpeg")],
  gallery: [assetPath("p1.webp"), assetPath("p4.jpg"), assetPath("p6 styling.jpg")],
  team: [
    assetPath("female sytlsit 1.jpeg"),
    assetPath("female stylsit 2.jpeg"),
    assetPath("male baber sytlist.jpeg")
  ],
  contact: [assetPath("p5 relaxation services.jpg"), assetPath("p3.jpg"), assetPath("p1.webp")],
  footer: [assetPath("p6 styling.jpg"), assetPath("premium wig.jpeg"), assetPath("p2 hair color.jpg")]
};

export const ceoProfiles = [
  {
    name: "Okonta Victor",
    role: "Founder and Creative Director",
    image: assetPath("ysmceo.jpeg"),
    summary: "Leads grooming standards, service quality, and the salon's client experience."
  },
  {
    name: "Okonta Lizzy",
    role: "Co-Founder and Operations Lead",
    image: assetPath("ysmwife.jpeg"),
    summary: "Oversees guest care, treatment quality, and the smooth running of daily operations."
  }
];

export const guestActionCards = [
  {
    title: "Book an appointment",
    description: "Choose services, see available slots, upload a style reference, and confirm your visit.",
    to: "/book",
    cta: "Start booking"
  },
  {
    title: "Order products",
    description: "Shop salon-approved products with live totals and delivery fee calculation.",
    to: "/order-products",
    cta: "Order products"
  },
  {
    title: "Track your updates",
    description: "Check appointment progress or order delivery without needing to call first.",
    to: "/track-booking",
    secondaryTo: "/track-order",
    cta: "Track booking",
    secondaryCta: "Track order"
  },
  {
    title: "Contact the salon",
    description: "Send a message to customer care or reach the team directly by call, email, or WhatsApp.",
    to: "/contact",
    cta: "Send a message"
  }
];

export const galleryItems = [
  { title: "Professional hair cuts", image: assetPath("p1.webp") },
  { title: "Hair coloring", image: assetPath("p2 hair color.jpg") },
  { title: "Facial treatments", image: assetPath("p3.jpg") },
  { title: "Nail services", image: assetPath("p4.jpg") },
  { title: "Relaxation services", image: assetPath("p5 relaxation services.jpg") },
  { title: "Professional styling", image: assetPath("p6 styling.jpg") }
];

export const teamMembers = [
  {
    name: "Chioma Eze",
    role: "Senior Hair Stylist",
    bio: "15+ years delivering precision styling, healthy hair routines, and polished finishes.",
    image: assetPath("female sytlsit 1.jpeg")
  },
  {
    name: "Amara Johnson",
    role: "Color Specialist",
    bio: "Focused on color correction, rich tones, and restorative treatment plans.",
    image: assetPath("female stylsit 2.jpeg")
  },
  {
    name: "Kola Adeyemi",
    role: "Master Barber",
    bio: "Known for sharp fades, beard detailing, and dependable grooming consistency.",
    image: assetPath("male baber sytlist.jpeg")
  },
  {
    name: "Ngozi Okonkwo",
    role: "Beauty Therapist",
    bio: "Handles facial care, wellness treatments, and calm recovery-focused sessions.",
    image: assetPath("female stylst 3.jpeg")
  }
];

export const fallbackProductImages = [
  assetPath("premium wig.jpeg"),
  assetPath("hair cream.jpeg"),
  assetPath("hair oil.jpeg"),
  assetPath("wig fresh oil.jpeg"),
  assetPath("bread oil.jpeg"),
  assetPath("face cream.jpeg")
];

export const businessHours = [
  "Monday - Friday: 9:00 AM - 7:00 PM",
  "Saturday: 10:00 AM - 6:00 PM",
  "Sunday: Closed"
];
