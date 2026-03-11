import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TrackBookingForm() {
  return (
    <form id="trackBookingForm" className="booking-form">
      <div className="form-group">
        <Label htmlFor="trackCode">Tracking Code *</Label>
        <Input
          type="text"
          id="trackCode"
          placeholder="e.g. BOOK-ABC12345"
          required
        />
      </div>

      <div className="form-group">
        <Label htmlFor="trackEmail">Booking Email *</Label>
        <Input type="email" id="trackEmail" placeholder="you@example.com" required />
      </div>

      <Button type="submit" className="submit-btn">
        Check Booking Status
      </Button>
    </form>
  );
}
