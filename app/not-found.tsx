import Link from "next/link";
export default function NotFound() { return <main className="grid min-h-screen place-items-center p-6"><div className="text-center"><p className="text-sm font-semibold text-sky-600">404</p><h1 className="mt-2 text-3xl font-semibold">This page wandered off.</h1><Link className="mt-6 inline-block text-sm font-medium text-sky-700" href="/dashboard">Return to dashboard</Link></div></main>; }

