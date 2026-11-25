import PropTypes from 'prop-types'

// Read-only star display. Works with decimals (4.27 -> 4 full stars + 27% of the 5th).
// ACCESSIBILITY: the visual stars are hidden from screen readers; the label says the value.
export default function StarRating({ value, size = 'text-base' }) {
  const safe = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <span className={`inline-flex ${size} leading-none`} role="img" aria-label={`${safe.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, safe - (i - 1))) * 100
        return (
          <span key={i} className="relative inline-block text-gray-300" aria-hidden="true">
            ★
            <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill}%` }}>★</span>
          </span>
        )
      })}
    </span>
  )
}

StarRating.propTypes = {
  value: PropTypes.number,
  size: PropTypes.string,
}
