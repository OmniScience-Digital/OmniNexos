"use client";
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center p-2 space-y-1 min-h-[100px]">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
        </div>
        <span className="text-gray-500 text-sm">Loading </span>
      </div>
    </div>
  );
}
