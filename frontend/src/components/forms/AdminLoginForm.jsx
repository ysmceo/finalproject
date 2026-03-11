import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginForm() {
  return (
    <form id="adminLoginForm">
      <div className="form-group">
        <Label htmlFor="loginEmail">
          <span data-i18n="admin_email">Email Address</span> *
        </Label>
        <Input type="email" id="loginEmail" required />
      </div>

      <div className="form-group">
        <Label htmlFor="loginPassword">
          <span data-i18n="admin_password">Password</span> *
        </Label>
        <Input type="password" id="loginPassword" required />
      </div>

      <div className="form-group">
        <Label htmlFor="loginSecretPasscode">Admin Secret Passcode *</Label>
        <Input type="password" id="loginSecretPasscode" required />
        <small>Enter this passcode to login directly, or request an OTP that will be sent to your admin email.</small>
      </div>

      <div className="form-group">
        <Button type="button" className="submit-btn secondary-action-btn" id="requestAccessCodeBtn">
          Send One-Time Access Code (Email OTP)
        </Button>
        <Label htmlFor="loginAccessCode">One-Time Access Code (Optional)</Label>
        <Input
          type="text"
          id="loginAccessCode"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit code (optional)"
        />
      </div>

      <div className="form-group">
        <button type="button" className="admin-compact-toggle" id="showForgotPasswordBtn" aria-expanded="false">
          <span id="forgotToggleLabel">Forgot password? Tap to reset</span>
          <span id="forgotToggleIcon" aria-hidden="true">
            ▾
          </span>
        </button>
        <small className="admin-auth-help">Keep this hidden unless you need to reset your password.</small>
      </div>

      <div className="form-group is-initially-hidden" id="forgotPasswordPanel">
        <Button type="button" className="submit-btn secondary-action-btn" id="requestPasswordResetCodeBtn">
          Send Password Reset OTP
        </Button>
        <Label htmlFor="resetAccessCode">Reset OTP Code *</Label>
        <Input
          type="text"
          id="resetAccessCode"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit OTP code"
        />

        <Label htmlFor="resetNewPassword" className="form-label-spaced">
          New Password *
        </Label>
        <Input type="password" id="resetNewPassword" placeholder="Enter new password (min 6 chars)" />

        <Button type="button" className="submit-btn secondary-action-btn" id="resetPasswordBtn">
          Reset Password
        </Button>
      </div>

      <small className="admin-auth-help">
        Tip: Use password + secret passcode for fastest login. OTP is optional.
      </small>

      <Button type="submit" className="submit-btn" data-i18n="admin_login_btn">
        Login
      </Button>
    </form>
  );
}
