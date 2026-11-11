// 83000 -> "1:23"
export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// 12450 -> "12,450"
export const oats = (n: number) => Math.floor(n).toLocaleString('en-US')

// 0.0312 -> "$0.031"
export const usd = (n: number) => `$${Number(n).toFixed(n < 1 ? 3 : 2)}`

// 3.42 -> "x3.4", 24.6 -> "x25"
export const odds = (n: number) => `x${n >= 10 ? Math.round(n) : n.toFixed(1)}`
