// Shared look for each review source (label + bar colour).
// Colour is never the only cue: the source name is always written next to it.
export const SOURCES = [
  { id: 'amazon', name: 'Amazon', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  { id: 'bestbuy', name: 'BestBuy', bar: 'bg-blue-600', badge: 'bg-blue-100 text-blue-800' },
  { id: 'walmart', name: 'Walmart', bar: 'bg-sky-400', badge: 'bg-sky-100 text-sky-800' },
]

export function sourceStyle(name) {
  return SOURCES.find((s) => s.name === name) || { name, bar: 'bg-gray-400', badge: 'bg-gray-100 text-gray-700' }
}
