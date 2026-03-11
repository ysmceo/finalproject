import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import legacyHtml from "@/legacy/home.html?raw";
import { initMain } from "@/legacy/main";
import BookingForm from "@/components/forms/BookingForm";
import AdminLoginForm from "@/components/forms/AdminLoginForm";
import AdminRegisterForm from "@/components/forms/AdminRegisterForm";
import ProductOrderForm from "@/components/forms/ProductOrderForm";
import TrackBookingForm from "@/components/forms/TrackBookingForm";
import TrackProductForm from "@/components/forms/TrackProductForm";
import ContactForm from "@/components/forms/ContactForm";

import "@/styles/legacy-main.css";

export default function Home() {
  const [mountNodes, setMountNodes] = useState(null);

  useEffect(() => {
    setMountNodes({
      productOrder: document.getElementById("productOrderFormMount"),
      booking: document.getElementById("bookingFormMount"),
      trackBooking: document.getElementById("trackBookingFormMount"),
      trackProduct: document.getElementById("trackProductFormMount"),
      contact: document.getElementById("contactFormMount"),
      adminLogin: document.getElementById("adminLoginFormMount"),
      adminRegister: document.getElementById("adminRegisterFormMount")
    });
  }, []);

  const ready = useMemo(
    () =>
      mountNodes &&
      mountNodes.productOrder &&
      mountNodes.booking &&
      mountNodes.trackBooking &&
      mountNodes.trackProduct &&
      mountNodes.contact &&
      mountNodes.adminLogin &&
      mountNodes.adminRegister,
    [mountNodes]
  );

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => initMain(), 0);
    return () => clearTimeout(id);
  }, [ready]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div dangerouslySetInnerHTML={{ __html: legacyHtml }} />
      {ready && createPortal(<ProductOrderForm />, mountNodes.productOrder)}
      {ready && createPortal(<BookingForm />, mountNodes.booking)}
      {ready && createPortal(<TrackBookingForm />, mountNodes.trackBooking)}
      {ready && createPortal(<TrackProductForm />, mountNodes.trackProduct)}
      {ready && createPortal(<ContactForm />, mountNodes.contact)}
      {ready && createPortal(<AdminLoginForm />, mountNodes.adminLogin)}
      {ready && createPortal(<AdminRegisterForm />, mountNodes.adminRegister)}
    </div>
  );
}
