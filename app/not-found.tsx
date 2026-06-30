import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-background px-container-margin">
      <div className="bg-surface-container-lowest text-on-surface p-xl rounded-[24px] max-w-md w-full text-center space-y-md shadow-lg border border-outline-variant/30">
        <span className="material-symbols-outlined text-[64px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
          explore_off
        </span>
        <h2 className="font-headline-md text-headline-md font-bold">Page Not Found</h2>
        <p className="font-body-md text-body-md opacity-80 text-on-surface-variant">
          We couldn't find the page you were looking for. It might have been moved or doesn't exist.
        </p>
        
        <div className="pt-sm">
          <Link
            href="/"
            className="w-full py-md bg-primary text-on-primary font-label-md text-label-md font-bold rounded-xl hover:bg-on-primary-container transition-colors shadow-sm cursor-pointer block"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
