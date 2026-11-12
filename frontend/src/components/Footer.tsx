import { Link } from 'react-router-dom'

const LINKS = [
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/support', 'Support'],
]

// The links to the policy pages and the support page, at the bottom of the profile and of the sign-in page.
// The width is the width of the content above it, so the links start where that content starts.
export default function Footer({ width = 'max-w-6xl' }: { width?: string }) {
  return (
    <footer className="border-t-2 border-line">
      <div className={`mx-auto flex h-14 ${width} items-center gap-6 px-4`}>
        {LINKS.map(([to, label]) => (
          <Link key={to} to={to} className="font-pixel text-[22.5px] leading-none text-muted hover:text-accent">
            {label}
          </Link>
        ))}
      </div>
    </footer>
  )
}
