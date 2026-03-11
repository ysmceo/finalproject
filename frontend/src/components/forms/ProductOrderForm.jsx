import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ProductOrderForm() {
  return (
    <form id="productOrderForm" className="booking-form">
      <div className="form-group">
        <Label htmlFor="productOrderName">Full Name *</Label>
        <Input type="text" id="productOrderName" required />
      </div>

      <div className="form-group">
        <Label htmlFor="productOrderEmail">Email Address *</Label>
        <Input type="email" id="productOrderEmail" required />
      </div>

      <div className="form-group">
        <Label htmlFor="productOrderPhone">Phone Number *</Label>
        <Input type="tel" id="productOrderPhone" required />
      </div>

      <div className="form-group">
        <Label htmlFor="productOrderAddress">Delivery Address *</Label>
        <Textarea
          id="productOrderAddress"
          rows={3}
          placeholder="Enter full delivery address"
          required
        />
        <div className="address-lookup-actions">
          <Button type="button" id="productOrderAddressMapBtn" className="address-map-btn">
            🗺️ Open map
          </Button>
          <small id="productOrderAddressLookupStatus" className="form-help-text-tight"></small>
        </div>
        <div
          id="productOrderAddressSuggestions"
          className="address-suggestions hidden"
          aria-live="polite"
        ></div>
      </div>

      <div className="form-group">
        <Label htmlFor="productOrderPaymentMethod">Payment Method *</Label>
        <select id="productOrderPaymentMethod" required className="shad-select">
          <option value="">Select payment method...</option>
          <option value="Cash">💵 Cash</option>
          <option value="Bank Transfer">🏦 Bank Transfer</option>
          <option value="Credit Card">💳 Credit Card</option>
          <option value="Debit Card">💳 Debit Card</option>
          <option value="USSD">📱 USSD</option>
        </select>
      </div>

      <div className="form-group">
        <Label htmlFor="productOrderDeliverySpeed">Delivery Speed *</Label>
        <select id="productOrderDeliverySpeed" required className="shad-select">
          <option value="standard">Standard Delivery</option>
          <option value="express">Express Delivery (Faster)</option>
        </select>
        <small className="form-help-text-tight">
          Express orders are prioritized in courier dispatch and auto-delivery progression.
        </small>
      </div>

      <div className="form-group">
        <label>🛍️ Select Products *</label>
        <div id="productOrderPicker" className="booking-product-picker">
          <div className="booking-product-empty">Products will load here...</div>
        </div>
        <div id="productOrderSummaryCard" className="order-summary-card" aria-live="polite">
          <div className="order-summary-row">
            <span>Items Subtotal</span>
            <strong id="productOrderSubtotal">₦0</strong>
          </div>
          <div className="order-summary-row">
            <span>Delivery Fee</span>
            <strong id="productOrderDeliveryFee">₦0</strong>
          </div>
          <div className="order-summary-row order-summary-row-total">
            <span>Estimated Grand Total</span>
            <strong id="productOrderGrandTotal">₦0</strong>
          </div>
          <small id="productOrderSummary" className="form-help-text-tight order-summary-text">
            Select product(s) to see your live total.
          </small>
        </div>
      </div>

      <Button type="submit" className="submit-btn">
        Place Product Order
      </Button>
      <Button type="button" id="clearProductOrderBtn" className="submit-btn submit-btn-secondary">
        Clear Form
      </Button>
    </form>
  );
}
