import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function BookingForm() {
  return (
    <form id="bookingForm" className="booking-form">
      <div className="booking-readiness" aria-live="polite">
        <div className="booking-readiness__head">
          <strong>Booking readiness</strong>
          <span id="bookingReadinessPercent" className="booking-readiness__percent">
            0%
          </span>
        </div>
        <div
          className="booking-readiness__track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
          aria-label="Booking form completion"
        >
          <span id="bookingReadinessBar" className="booking-readiness__bar"></span>
        </div>
        <small id="bookingReadinessHint" className="booking-readiness__hint">
          Complete required fields to continue smoothly.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="name">
          <span data-i18n="booking_fullname">Full Name</span> *
        </Label>
        <Input
          type="text"
          id="name"
          required
          autoComplete="name"
          placeholder="e.g. Okonta Victor"
        />
        <small className="form-help-text-tight">
          Use the same name you want on your booking confirmation.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="email">
          <span data-i18n="booking_email">Email Address</span> *
        </Label>
        <Input
          type="email"
          id="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
        />
        <small className="form-help-text-tight">
          We use this email for booking updates and tracking details.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="phone">
          <span data-i18n="booking_phone">Phone Number</span> *
        </Label>
        <Input
          type="tel"
          id="phone"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="080..."
        />
        <small className="form-help-text-tight">
          Use an active number so we can reach you quickly if needed.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="service">
          <span data-i18n="booking_service">Select Service</span> *
        </Label>
        <select id="service" required className="shad-select">
          <option value="" data-i18n="booking_choose_service">
            Choose a service...
          </option>
        </select>
      </div>

      <div className="form-group">
        <Label htmlFor="date">
          <span data-i18n="booking_date">Preferred Date</span> *
        </Label>
        <Input type="date" id="date" required />
        <small className="form-help-text-tight">Choose your preferred appointment date.</small>
      </div>

      <div className="form-group">
        <Label htmlFor="time">
          <span data-i18n="booking_time">Preferred Time</span> *
        </Label>
        <Input type="time" id="time" required />
        <small className="form-help-text-tight">
          Select a convenient time slot. We’ll confirm availability.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="language" data-i18n="booking_language">
          Preferred Language
        </Label>
        <Input
          id="language"
          list="bookingLanguageList"
          placeholder="Type to search language (e.g. English, Yoruba)"
          autoComplete="off"
        />
        <datalist id="bookingLanguageList">
          <option value="English"></option>
          <option value="Yoruba"></option>
          <option value="Hausa"></option>
          <option value="Igbo"></option>
          <option value="Pidgin"></option>
          <option value="French"></option>
          <option value="Spanish"></option>
          <option value="Portuguese"></option>
          <option value="Arabic"></option>
          <option value="Chinese"></option>
          <option value="Hindi"></option>
          <option value="Swahili"></option>
          <option value="German"></option>
          <option value="Italian"></option>
          <option value="Dutch"></option>
          <option value="Russian"></option>
          <option value="Turkish"></option>
          <option value="Japanese"></option>
          <option value="Korean"></option>
          <option value="Other"></option>
        </datalist>
        <small className="form-help-text-tight">Start typing to quickly find your preferred language.</small>
      </div>

      <div className="form-group">
        <Label htmlFor="paymentMethod">
          <span data-i18n="booking_payment">Payment Method</span> *
        </Label>
        <select id="paymentMethod" required className="shad-select">
          <option value="" data-i18n="booking_select_payment">
            Select payment method...
          </option>
          <option value="Credit Card">💳 Credit Card</option>
          <option value="Debit Card">💳 Debit Card</option>
          <option value="Paystack Bank Transfer">🏦 Paystack Bank Transfer (Instant)</option>
          <option value="Bank Transfer">🏦 Bank Transfer</option>
          <option value="USSD">📱 USSD (Mobile Money)</option>
          <option value="Cash">💵 Cash Payment</option>
        </select>
      </div>

      <div className="form-group is-initially-hidden" id="onlinePaymentChannelGroup">
        <Label htmlFor="paymentChannel">Online Payment Option</Label>
        <select id="paymentChannel" className="shad-select">
          <option value="">Auto (recommended)</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="ussd">USSD</option>
        </select>
        <small className="form-help-text">Choose how you want to pay instantly (optional).</small>

        <Label htmlFor="paymentProvider" className="form-label-spaced">
          Payment Provider
        </Label>
        <select id="paymentProvider" className="shad-select">
          <option value="">Auto (use what is configured)</option>
          <option value="paystack">Paystack</option>
          <option value="monnify">Monnify</option>
          <option value="stripe">Stripe</option>
        </select>
        <small className="form-help-text">If one provider is not configured, Auto will use the other.</small>
      </div>

      <div className="form-group">
        <Label htmlFor="paymentPlan">Payment Option *</Label>
        <select id="paymentPlan" required className="shad-select">
          <option value="">Select payment option...</option>
          <option value="full">Pay Full Amount</option>
          <option value="deposit_50">Pay 50% Deposit</option>
        </select>
        <small id="paymentSummary" className="form-help-text">
          Select a service to see payment details.
        </small>
      </div>

      <div className="form-group">
        <label className="radio-label">
          <input type="checkbox" id="homeServiceRequested" className="shad-checkbox" />
          <span>Request Home Service (Optional)</span>
        </label>
      </div>

      <div className="form-group is-initially-hidden" id="homeServiceAddressGroup">
        <Label htmlFor="homeServiceAddress">Home Service Address *</Label>
        <Textarea
          id="homeServiceAddress"
          rows={3}
          placeholder="Enter your address for home service..."
         
        />
        <div className="address-lookup-actions">
          <Button type="button" id="homeServiceAddressMapBtn" className="address-map-btn">
            🗺️ Open map
          </Button>
          <small id="homeServiceAddressLookupStatus" className="form-help-text-tight"></small>
        </div>
        <div
          id="homeServiceAddressSuggestions"
          className="address-suggestions hidden"
          aria-live="polite"
        ></div>
      </div>

      <div className="form-group">
        <Label htmlFor="refreshment" data-i18n="booking_refreshment">
          Would you like refreshment during your appointment?
        </Label>
        <div className="radio-group">
          <label className="radio-label">
            <input type="radio" name="refreshment" value="Yes" id="refreshmentYes" className="shad-radio" />
            <span data-i18n="booking_yes">Yes, please</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="refreshment"
              value="No"
              id="refreshmentNo"
              className="shad-radio"
              defaultChecked
            />
            <span data-i18n="booking_no">No, thank you</span>
          </label>
        </div>
      </div>

      <div className="form-group">
        <Label htmlFor="specialRequests" data-i18n="booking_requests">
          Special Requests or Notes
        </Label>
        <Textarea
          id="specialRequests"
          rows={4}
          placeholder="Let us know any special requests, allergies, or preferences you may have..."
        />
      </div>

      <div className="form-group">
        <label>🛍️ Pick Products to Buy with This Booking (Optional)</label>
        <div id="bookingProductPicker" className="booking-product-picker">
          <div className="booking-product-empty">Products will load here...</div>
        </div>
        <small className="form-help-text-tight">
          Select any product(s) you want to buy from the store while booking your service.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="styleImage" data-i18n="booking_image">
          📸 Upload Style Reference Image (Optional)
        </Label>
        <Input type="file" id="styleImage" accept="image/*" className="compact-file-input" />
        <small className="form-help-text-tight" data-i18n="booking_image_help">
          Upload a photo of the hairstyle you want. This helps our stylists understand your vision better.
        </small>
        <div id="imagePreview" className="preview-space-top"></div>
      </div>

      <Button type="submit" className="submit-btn" data-i18n="booking_submit">
        Book Appointment
      </Button>
    </form>
  );
}
