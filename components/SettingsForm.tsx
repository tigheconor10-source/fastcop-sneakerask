"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

const COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta",
  "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia",
  "Spain", "Sweden", "United Kingdom", "Switzerland", "Norway", "Iceland",
  "Albania", "Bosnia and Herzegovina", "Kosovo", "Moldova", "Montenegro",
  "North Macedonia", "Serbia", "Turkey", "Ukraine",
  "Canada", "United States", "Australia", "Japan", "South Korea", "Other",
];

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <label className={`block ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function SettingsForm({ profile, isOnboarding = false }: { profile: Profile; isOnboarding?: boolean }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [idNumber, setIdNumber] = useState(profile.id_number ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [zipCode, setZipCode] = useState(profile.zip_code ?? "");
  const [country, setCountry] = useState(profile.country ?? "");
  const [bankAccountHolder, setBankAccountHolder] = useState(profile.bank_account_holder ?? "");
  const [iban, setIban] = useState(profile.iban ?? "");
  const [bicSwift, setBicSwift] = useState(profile.bic_swift ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName.trim() || null,
        id_number: idNumber.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        zip_code: zipCode.trim() || null,
        country: country || null,
        bank_account_holder: bankAccountHolder.trim() || null,
        iban: iban.trim() || null,
        bic_swift: bicSwift.trim() || null,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Error saving profile");
    } else {
      setSaved(true);
      if (isOnboarding) {
        window.location.href = "/dashboard";
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Seller information</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" span2>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required={isOnboarding} className="input" />
          </Field>
          <Field label="ID / Passport number">
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="X0000000X" className="input font-mono" />
          </Field>
          <Field label="Phone number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" required={isOnboarding} className="input font-mono" />
          </Field>
          <Field label="Address" span2>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street and number" required={isOnboarding} className="input" />
          </Field>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madrid" required={isOnboarding} className="input" />
          </Field>
          <Field label="ZIP / Postal code">
            <input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="28001" required={isOnboarding} className="input font-mono" />
          </Field>
          <Field label="Country">
            <select value={country} onChange={(e) => setCountry(e.target.value)} required={isOnboarding} className="input bg-surface">
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold">Payout details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank account holder name" span2>
            <input value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="Jane Doe" required={isOnboarding} className="input" />
          </Field>
          <Field label="IBAN">
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" required={isOnboarding} className="input font-mono" />
          </Field>
          <Field label="BIC / SWIFT">
            <input value={bicSwift} onChange={(e) => setBicSwift(e.target.value)} placeholder="ABCDESBBXXX" className="input font-mono" />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : isOnboarding ? "Save and start listing →" : "Save changes"}
        </button>
        {saved && !isOnboarding && <span className="text-sm text-status-sold">✓ Saved</span>}
        {error && <span className="text-sm text-status-rejected">{error}</span>}
      </div>
    </form>
  );
}
