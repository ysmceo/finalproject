import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import Book from "@/pages/Book";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/NotFound";
import OrderProducts from "@/pages/OrderProducts";
import TrackBooking from "@/pages/TrackBooking";
import TrackOrder from "@/pages/TrackOrder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book" element={<Book />} />
        <Route path="/order-products" element={<OrderProducts />} />
        <Route path="/track-booking" element={<TrackBooking />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/dashboard" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
