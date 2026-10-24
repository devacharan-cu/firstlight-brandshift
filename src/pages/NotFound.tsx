import { Link } from '../router';

export default function NotFound() {
  return (
    <section className="wrap notfound" aria-labelledby="nf-title">
      <p className="label">404 · off the map</p>
      <h1 id="nf-title">This street isn’t on Kesarnagar’s map.</h1>
      <p className="pagehead__lede">The page you asked for doesn’t exist. These do:</p>
      <ul className="notfound__links">
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/app">The console</Link>
        </li>
        <li>
          <Link to="/platform">The platform</Link>
        </li>
        <li>
          <Link to="/case-study">The case study</Link>
        </li>
      </ul>
    </section>
  );
}
