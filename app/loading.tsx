export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-background">
      <div className="flex flex-col items-center gap-lg">
        {/* Animated Loading Circle */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <svg className="w-full h-full animate-spin">
            <circle 
              className="text-surface-container-highest" 
              cx="32" 
              cy="32" 
              fill="transparent" 
              r="28" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <circle 
              className="text-primary" 
              cx="32" 
              cy="32" 
              fill="transparent" 
              r="28" 
              stroke="currentColor" 
              strokeDasharray="175.9" 
              strokeDashoffset="44" 
              strokeWidth="4"
            />
          </svg>
        </div>
        <div className="text-center space-y-base">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-widest animate-pulse">Loading...</p>
        </div>
      </div>
    </div>
  );
}
