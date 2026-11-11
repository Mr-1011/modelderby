import { Link, useLocation } from 'react-router-dom'

// Our own button to the sign-in page. It passes the current page, so the player returns to it after the sign-in.
export default function SignInLink() {
  const { pathname } = useLocation()
  return (
    <Link
      to="/signin"
      state={{ from: pathname }}
      className="inline-grid h-10 shrink-0 place-items-center whitespace-nowrap border-2 border-accent px-4 font-pixel text-[30px] leading-none text-accent hover:bg-accent hover:text-on-accent"
    >
      Sign in
    </Link>
  )
}
