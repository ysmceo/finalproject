import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ContactForm() {
  return (
    <form id="contactForm" className="contact-form">
      <div className="form-group">
        <Label htmlFor="contactName">
          <span data-i18n="contact_name">Full Name</span> *
        </Label>
        <Input type="text" id="contactName" required />
      </div>

      <div className="form-group">
        <Label htmlFor="contactEmail">
          <span data-i18n="contact_email">Email Address</span> *
        </Label>
        <Input type="email" id="contactEmail" required />
      </div>

      <div className="form-group">
        <Label htmlFor="contactSubject">
          <span data-i18n="contact_subject">Subject</span> *
        </Label>
        <Input type="text" id="contactSubject" required />
      </div>

      <div className="form-group">
        <Label htmlFor="customerCarePriority">Support Priority</Label>
        <select id="customerCarePriority" className="shad-select" defaultValue="normal">
          <option value="normal">Normal (within 24 hours)</option>
          <option value="priority">Priority (within 4-8 hours)</option>
          <option value="urgent">Urgent (same day attention)</option>
        </select>
        <small className="form-help-text-tight">
          Choose urgency so our customer care team can route your request faster.
        </small>
      </div>

      <div className="form-group">
        <Label htmlFor="preferredContactChannel">Preferred Reply Channel</Label>
        <select id="preferredContactChannel" className="shad-select" defaultValue="email">
          <option value="email">Email</option>
          <option value="phone">Phone Call</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>

      <div className="form-group">
        <Label htmlFor="contactMessageText">
          <span data-i18n="contact_message">Message</span> *
        </Label>
        <Textarea id="contactMessageText" rows={5} required />
      </div>

      <div className="form-group">
        <Label htmlFor="reportType" data-i18n="contact_reporttype">
          Report Type (Optional)
        </Label>
        <select id="reportType" className="shad-select">
          <option value="" data-i18n="contact_general">
            General Message
          </option>
          <option value="service_feedback" data-i18n="contact_feedback">
            Service Feedback Report
          </option>
          <option value="complaint" data-i18n="contact_complaint">
            Complaint Report
          </option>
          <option value="suggestion" data-i18n="contact_suggestion">
            Suggestion Report
          </option>
          <option value="experience" data-i18n="contact_experience">
            Experience Report
          </option>
        </select>
      </div>

      <div className="form-group">
        <Label htmlFor="reportFile" data-i18n="contact_file">
          📎 Attach Report Evidence/Images (Optional)
        </Label>
        <Input type="file" id="reportFile" accept="image/*,.pdf,.doc,.docx" className="compact-file-input" />
        <small className="form-help-text-tight" data-i18n="contact_file_help">
          You can upload images, PDF, or documents as proof/evidence for your report.
        </small>
        <div id="reportFilePreview" className="preview-space-top"></div>
      </div>

      <Button type="submit" className="submit-btn" data-i18n="contact_submit">
        Send Message
      </Button>
    </form>
  );
}
