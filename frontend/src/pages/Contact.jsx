import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailRow, Field, Notice, SectionHeading, SelectField, Surface, TextField, TextareaField } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { apiRequest } from "@/lib/api";
import { getErrorMessage } from "@/lib/site";
import { businessHours, salonContact, sectionBackdrops } from "@/lib/landing";

function ContactHeroAside() {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.9rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">Customer care</p>
        <p className="mt-4 text-sm leading-7 text-white/80">
          Reach the salon for appointments, follow-up care, feedback, complaints, or support.
        </p>
      </div>
      <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">Fast channels</p>
        <p className="mt-3 text-lg font-semibold">{salonContact.phone}</p>
        <p className="mt-1 text-sm text-white/70">{salonContact.email}</p>
      </div>
    </div>
  );
}

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    reportType: ""
  });
  const [reportFile, setReportFile] = useState(null);
  const [notice, setNotice] = useState(null);
  const [ticket, setTicket] = useState(null);

  async function submitMessage(event) {
    event.preventDefault();
    setNotice(null);

    const payload = new FormData();
    payload.append("name", form.name);
    payload.append("email", form.email);
    payload.append("subject", form.subject);
    payload.append("message", form.message);
    payload.append("reportType", form.reportType || "general_message");

    if (reportFile) {
      payload.append("reportFile", reportFile);
    }

    try {
      const data = await apiRequest("/api/messages", { method: "POST", body: payload });
      setTicket(data?.data?.id || null);
      setNotice({ tone: "success", message: data.message || "Message sent successfully." });
    } catch (error) {
      setNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  return (
    <SitePageShell
      aside={<ContactHeroAside />}
      backgroundImages={sectionBackdrops.contact}
      description="The homepage contact section is now cleaner, while the full support form remains available on its own page."
      eyebrow="Contact"
      primaryAction={{ label: "Book now", to: "/book" }}
      secondaryAction={{ label: "Track booking", to: "/track-booking" }}
      title="Send a message to the salon"
    >
      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Surface className="space-y-5">
          <SectionHeading
            description="Send feedback, ask a question, or share an issue with optional image or document evidence."
            eyebrow="Message form"
            title="Customer care desk"
          />
          <Notice message={notice?.message} tone={notice?.tone} />
          <form className="space-y-4" onSubmit={submitMessage}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="contact-name"
                label="Full name"
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
                value={form.name}
              />
              <TextField
                id="contact-email"
                label="Email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={form.email}
              />
            </div>
            <TextField
              id="contact-subject"
              label="Subject"
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              required
              value={form.subject}
            />
            <SelectField
              id="contact-report-type"
              label="Report type"
              onChange={(event) => setForm((current) => ({ ...current, reportType: event.target.value }))}
              value={form.reportType}
            >
              <option value="">General message</option>
              <option value="service_feedback">Service feedback</option>
              <option value="complaint">Complaint</option>
              <option value="suggestion">Suggestion</option>
              <option value="experience">Experience report</option>
            </SelectField>
            <TextareaField
              id="contact-message"
              label="Message"
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              required
              rows={6}
              value={form.message}
            />
            <Field help="Optional image or document upload." htmlFor="contact-file" label="Attachment">
              <Input
                accept="image/*,.pdf,.doc,.docx"
                id="contact-file"
                onChange={(event) => setReportFile(event.target.files?.[0] || null)}
                type="file"
              />
            </Field>
            <Button className="w-full sm:w-auto" type="submit">Send message</Button>
          </form>
        </Surface>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Surface className="space-y-5">
            <SectionHeading
              description="Direct lines for urgent issues or quick follow-up."
              eyebrow="Contact details"
              title="Reach us directly"
            />
            <div className="space-y-3 rounded-[1.5rem] border border-line/70 bg-panel/92 px-5 py-4">
              <DetailRow label="Address" value={salonContact.address} />
              <DetailRow label="Phone" value={salonContact.phone} />
              <DetailRow label="Email" value={salonContact.email} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild className="w-full sm:w-auto">
                <a href={`tel:${salonContact.phone}`}>Call support</a>
              </Button>
              <Button asChild className="w-full sm:w-auto" variant="outline">
                <a href={salonContact.whatsapp} rel="noreferrer" target="_blank">
                  WhatsApp support
                </a>
              </Button>
              <Button asChild className="w-full sm:w-auto" variant="ghost">
                <a href={`mailto:${salonContact.email}`}>Email support</a>
              </Button>
            </div>
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading eyebrow="Hours" title="Business schedule" />
            <div className="space-y-3 rounded-[1.5rem] border border-line/70 bg-panel/92 px-5 py-4 text-sm text-ink-soft">
              {businessHours.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <Notice
              className="text-sm"
              message={ticket ? `Message received. Reference: ${ticket}` : null}
              tone="success"
            />
          </Surface>
        </div>
      </section>
    </SitePageShell>
  );
}
