import { Link } from '../router';
import { PRODUCT_LINKS, Wordmark } from './SiteHeader';

const COMPANY = [
  { to: '/industries', label: 'Industries' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/resources', label: 'Resources' },
  { to: '/demo', label: 'Book a walkthrough' },
  { to: '/credits', label: 'Photography & credits' },
];

export function SiteFooter() {
  return (
    <footer className="sitefoot">
      <div className="wrap sitefoot__top">
        <div className="sitefoot__brand">
          <Link className="wordmark" to="/" aria-label="Firstlight home">
            <Wordmark />
          </Link>
          <p>Route planning for delivery fleets. A fictional product with a working routing engine.</p>
        </div>
        <nav className="sitefoot__cols" aria-label="Footer">
          <div>
            <p className="label">Platform</p>
            <ul>
              {PRODUCT_LINKS.platform.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Console</p>
            <ul>
              {PRODUCT_LINKS.console.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Firstlight</p>
            <ul>
              {COMPANY.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
      <div className="wrap sitefoot__bs">
        <p>
          <strong>Firstlight is fictional. The craft is real.</strong> BrandShift researched, designed and built this site to show
          what a product story can do when the product itself is on the page.
        </p>
        <Link className="btn btn--light" to="/case-study">
          Read the case study →
        </Link>
      </div>
      <div className="wrap sitefoot__legal">
        <p>
          © 2026 BrandShift. A portfolio demonstration. Firstlight, Kesarnagar, its businesses, orders, prices and figures are
          invented; any resemblance to real ones is coincidental. Photographs and footage are real, licensed captures of unrelated
          places, used illustratively. See <Link to="/credits">credits</Link>.
        </p>
        <p>Typeset in Overpass and Overpass Mono (SIL Open Font License). No cookies, no trackers, no third-party requests.</p>
      </div>
    </footer>
  );
}
