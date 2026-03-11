import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminRegisterForm() {
  return (
    <form id="adminRegisterForm">
      <div className="form-group">
        <Label htmlFor="registerName">
          <span data-i18n="admin_name">Full Name</span> *
        </Label>
        <Input type="text" id="registerName" required />
      </div>

      <div className="form-group">
        <Label htmlFor="registerEmail">
          <span data-i18n="admin_email">Email Address</span> *
        </Label>
        <Input type="email" id="registerEmail" required />
      </div>

      <div className="form-group">
        <Label htmlFor="registerPassword">
          <span data-i18n="admin_password">Password</span> *
        </Label>
        <Input type="password" id="registerPassword" required />
      </div>

      <div className="form-group">
        <Label htmlFor="registerSecretPasscode">Admin Secret Passcode *</Label>
        <Input type="password" id="registerSecretPasscode" required />
        <small>Required for one-time initial admin registration.</small>
      </div>

      <Button type="submit" className="submit-btn" data-i18n="admin_register_btn">
        Register
      </Button>
    </form>
  );
}
