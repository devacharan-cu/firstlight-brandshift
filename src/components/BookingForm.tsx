import { useState, type FormEvent } from 'react';

interface Errors {
  name?: string;
  email?: string;
  company?: string;
  fleet?: string;
}

/** Booking form. There is no backend: the form validates, then says plainly that nothing was sent. */
export function BookingForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<null | { name: string }>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const company = String(data.get('company') ?? '').trim();
    const fleet = String(data.get('fleet') ?? '');
    const next: Errors = {};
    if (!name) next.name = 'Tell us who to ask for.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a work email like name@company.com.';
    if (!company) next.company = 'Which company runs the fleet?';
    if (!fleet) next.fleet = 'Choose a fleet size.';
    setErrors(next);
    if (Object.keys(next).length) {
      e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    setResult({ name });
  };

  const field = (id: keyof Errors) => ({
    id: `f-${id}`,
    name: id,
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `f-${id}-err` : undefined,
  });

  if (result) {
    return (
      <div className="formcard formcard__done" role="status">
        <p className="label">Demonstration only</p>
        <h3>Nothing was sent, {result.name.split(' ')[0]}.</h3>
        <p>
          Firstlight is a fictional product, and this site has no backend, so your details went nowhere and weren’t stored. On a real site, this
          form would book the call and confirm it by email.
        </p>
        <button className="btn btn--quiet" onClick={() => setResult(null)}>
          Back to the form
        </button>
      </div>
    );
  }

  return (
    <form className="formcard" noValidate onSubmit={onSubmit}>
      <p className="formcard__note">
        <strong>Demo form.</strong> Submitting won’t send anything. Firstlight is fictional.
      </p>
      <div className="field">
        <label htmlFor="f-name">Your name</label>
        <input {...field('name')} autoComplete="name" />
        {errors.name && (
          <p className="field__err" id="f-name-err">
            {errors.name}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="f-email">Work email</label>
        <input {...field('email')} type="email" autoComplete="email" inputMode="email" />
        {errors.email && (
          <p className="field__err" id="f-email-err">
            {errors.email}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="f-company">Company</label>
        <input {...field('company')} autoComplete="organization" />
        {errors.company && (
          <p className="field__err" id="f-company-err">
            {errors.company}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="f-fleet">Vans you run each day</label>
        <select {...field('fleet')} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          <option>Under 10</option>
          <option>10–40</option>
          <option>40–150</option>
          <option>More than 150</option>
        </select>
        {errors.fleet && (
          <p className="field__err" id="f-fleet-err">
            {errors.fleet}
          </p>
        )}
      </div>
      <button className="btn btn--primary formcard__submit" type="submit">
        Request a walkthrough
      </button>
    </form>
  );
}
