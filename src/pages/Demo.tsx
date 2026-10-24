import { BookingForm } from '../components/BookingForm';
import { Credit, Photo } from '../components/media';
import { Link } from '../router';

export default function Demo() {
  return (
    <div className="demo">
      <header className="pagehead pagehead--field pagehead--photo">
        <Photo id="van-interior" sizes="100vw" priority className="pagehead__bg" />
        <div className="wrap pagehead__over">
          <p className="label">Book a walkthrough</p>
          <h1>Bring a day of orders. Leave with a plan.</h1>
          <p className="pagehead__lede">
            Thirty minutes on a call. We plan your real orders live, next to how you plan them today, and tell you honestly where Firstlight would
            and wouldn’t help.
          </p>
          <Credit kind="photo" id="van-interior" />
        </div>
      </header>

      <section className="wrap demo__grid" aria-label="Request a walkthrough">
        <div className="demo__what">
          <h2 className="section-title">What happens in thirty minutes</h2>
          <ol className="agenda">
            <li>
              <span className="mono">00:00</span>
              <strong>Your day, your orders.</strong> Share a spreadsheet of one ordinary day: addresses, sizes, depot.
            </li>
            <li>
              <span className="mono">05:00</span>
              <strong>Planned live.</strong> We plan it while you watch and put it next to your current routes.
            </li>
            <li>
              <span className="mono">15:00</span>
              <strong>Break it.</strong> Add an urgent order, close a road, take a van off the road, and see what changes.
            </li>
            <li>
              <span className="mono">25:00</span>
              <strong>An honest read.</strong> Where the numbers move, where they don’t, and what it would take to run it.
            </li>
          </ol>
          <p className="demo__alt">
            Prefer to explore first? <Link to="/app">Open the console</Link> or <Link to="/integrations#import">import your own CSV</Link>.
          </p>
        </div>
        <BookingForm />
      </section>
    </div>
  );
}
