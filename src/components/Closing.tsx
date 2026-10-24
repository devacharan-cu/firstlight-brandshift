import { useState, type FormEvent } from 'react';

interface Errors {
  name?: string;
  email?: string;
  company?: string;
  fleet?: string;
}

/** Booking form. There is no backend: the form validates, then says plainly that nothing was sent. */
export function Closing() {
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<null | { name: string; fleet: string }>(null);

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
      const first = e.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`);
      first?.focus();
      return;
    }
    setResult({ name, fleet });
  };

  const field = (id: keyof Errors) => ({
    id: `f-${id}`,
    name: id,
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `f-${id}-err` : undefined,
  });

  return (
    <section id="book" className="night" data-clock="19:45" aria-labelledby="book-title">
      <div className="wrap night__grid">
        <div>
          <p className="label night__label">After the last van is back</p>
          <h2 id="book-title">See your own orders untangled.</h2>
          <p className="night__lede">
            A walkthrough takes 30 minutes. Bring a day of orders as a spreadsheet and we’ll plan them live, against how you plan
            today.
          </p>
          <ul className="night__list">
            <li>We plan your real orders while you watch</li>
            <li>We compare the result with your current routes</li>
            <li>You get an honest read on where Firstlight would and wouldn’t help</li>
          </ul>
        </div>

        <div className="formcard">
          {result ? (
            <div className="formcard__done" role="status">
              <p className="label">Demonstration only</p>
              <h3>Nothing was sent, {result.name.split(' ')[0]}.</h3>
              <p>
                Firstlight is a fictional product, and this page has no backend, so your details went nowhere and weren’t stored.
                On a real site, this form would book the call and confirm by email.
              </p>
              <button className="btn btn--quiet" onClick={() => setResult(null)}>
                Back to the form
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={onSubmit}>
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
          )}
        </div>
      </div>

      <div className="wrap brandshift">
        <p className="label night__label">About this site</p>
        <p className="brandshift__line">
          Firstlight is fictional. The craft is real. <strong>BrandShift</strong> designed and built this site to show what a product
          story can do when the product itself is on the page: a working routing engine, a city drawn in code, and a page that
          stays fast.
        </p>
        <a className="btn btn--light" href="/case-study.html">
          Read the case study →
        </a>
      </div>

      <footer className="wrap foot">
        <p>
          © 2026 BrandShift. A portfolio demonstration. Firstlight, Kesarnagar, its businesses and orders are invented; any
          resemblance to real ones is coincidental. Map drawn from a procedurally generated street network; no real geographic data
          is used.
        </p>
        <p>
          Typeset in Overpass and Overpass Mono (SIL Open Font License), self-hosted. No cookies, no trackers, no third-party
          requests.
        </p>
      </footer>
    </section>
  );
}
