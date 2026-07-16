export default function StatCard({ label, value, sublabel }) {
  return (
    <div className="stat-card">
      <span className="label">{label}</span>
      <span className="stat">{value}</span>
      {sublabel ? <span className="body-muted">{sublabel}</span> : null}
    </div>
  );
}
