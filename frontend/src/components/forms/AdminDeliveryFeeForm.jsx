import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminDeliveryFeeForm() {
  return (
    <form id="productDeliveryFeeForm" className="product-form">
      <div className="product-form-grid">
        <Input
          type="number"
          id="adminStandardDeliveryFee"
          placeholder="Standard Delivery Fee (₦)"
          min="0"
          step="1"
          required
        />
        <Input
          type="number"
          id="adminExpressDeliveryFee"
          placeholder="Express Delivery Fee (₦)"
          min="0"
          step="1"
          required
        />
      </div>
      <Button type="submit" className="btn btn-accept">
        Save Delivery Fees
      </Button>
      <div id="productDeliveryFeeMessage" className="message"></div>
    </form>
  );
}
