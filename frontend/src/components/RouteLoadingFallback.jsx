const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-canvas flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-text-muted">Loading...</p>
    </div>
  </div>
);

export default RouteLoadingFallback;
