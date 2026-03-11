import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TrackProductForm() {
  return (
    <form id="trackProductForm" className="booking-form">
      <div className="form-group">
        <Label htmlFor="trackProductCode">Product Order Code *</Label>
        <Input
          type="text"
          id="trackProductCode"
          placeholder="e.g. ORD-MA4N7X2"
          required
        />
      </div>

      <div className="form-group">
        <Label htmlFor="trackProductEmail">Order Email *</Label>
        <Input
          type="email"
          id="trackProductEmail"
          placeholder="you@example.com"
          required
        />
      </div>

      <Button type="submit" className="submit-btn">
        Check Product Order Status
      </Button>
    </form>
  );
}
