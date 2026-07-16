// The recurring visual signature for price call-outs across the app: a
// fully-rounded amber pill, never a plain rectangle. Reserved for price and
// savings — using it anywhere else would dilute what it signals.
export default function PriceBadge({ price, label = 'best price nearby' }) {
  return (
    <div className="price-badge">
      <span className="price-badge-price">${price.toFixed(2)}</span>
      <span className="price-badge-label">{label}</span>
    </div>
  );
}
