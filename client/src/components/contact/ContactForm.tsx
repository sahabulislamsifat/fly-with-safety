'use client';

import { Button, Input, Textarea } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';

export function ContactForm() {
  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="First Name"
          placeholder="John"
          required
        />
        <Input
          label="Last Name"
          placeholder="Doe"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="Email"
          type="email"
          placeholder="john@example.com"
          required
        />
        <Input
          label="Phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
        />
      </div>
      <Input
        label="Subject"
        placeholder="Booking inquiry"
        required
      />
      <Textarea
        label="Message"
        placeholder="How can we help you?"
        rows={5}
        required
      />
      <Button variant="primary" size="lg" type="submit" className="w-full sm:w-auto">
        <Icon name="send" size={20} />
        Send Message
      </Button>
    </form>
  );
}