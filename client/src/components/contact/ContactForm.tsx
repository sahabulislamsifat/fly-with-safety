'use client';

import { useState } from 'react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import { Icon } from '@/components/ui/Icons';
import { submitContact } from '@/lib/api/contact';

export function ContactForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [serviceType, setServiceType] = useState<
    'flights' | 'hotels' | 'packages' | 'visa' | 'other'
  >('flights');
  const [message, setMessage] = useState('');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !subject || !message) return;

    setStatus('submitting');
    setErrorMessage(null);

    try {
      const res = await submitContact({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        subject,
        serviceType,
        message,
      });

      setReferenceNumber(res.referenceNumber);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to submit contact request. Please try again.'
      );
    }
  };

  const handleReset = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSubject('');
    setMessage('');
    setStatus('idle');
    setReferenceNumber(null);
  };

  if (status === 'success') {
    return (
      <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-xs text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xs flex items-center justify-center mx-auto">
          <Icon name="check" size={24} />
        </div>
        <h3 className="text-xl font-bold text-text-primary">Message Received!</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Thank you for contacting FlyWithsafety. Your message has been assigned reference number:
        </p>
        <div className="inline-block px-4 py-2 bg-white border border-emerald-300 rounded-xs font-mono font-bold text-lg text-brand-primary">
          {referenceNumber}
        </div>
        <p className="text-xs text-text-tertiary">
          A confirmation email has been dispatched to <strong>{email}</strong>. Our travel support desk will follow up promptly.
        </p>
        <div className="pt-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Send Another Message
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {status === 'error' && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xs">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          required
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="john@example.com"
          required
        />
        <Input
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+880 1712-345678"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Booking or general inquiry"
          required
        />
        <Select
          label="Service Category"
          value={serviceType}
          onChange={(e) =>
            setServiceType(
              (e.target.value as 'flights' | 'hotels' | 'packages' | 'visa' | 'other') ||
                'flights'
            )
          }
          options={[
            { value: 'flights', label: 'Flight Booking / Assistance' },
            { value: 'hotels', label: 'Hotel Reservation' },
            { value: 'packages', label: 'Holiday Package' },
            { value: 'visa', label: 'Visa Information & Support' },
            { value: 'other', label: 'Other Support' },
          ]}
        />
      </div>

      <Textarea
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="How can our travel specialists assist you? (Minimum 10 characters)"
        rows={5}
        required
      />

      <Button
        variant="primary"
        size="lg"
        type="submit"
        disabled={status === 'submitting'}
        className="w-full sm:w-auto"
      >
        {status === 'submitting' ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-xs animate-spin" />
            Sending Message...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Icon name="send" size={20} />
            Send Message
          </span>
        )}
      </Button>
    </form>
  );
}