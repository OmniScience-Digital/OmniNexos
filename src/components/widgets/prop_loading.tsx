"use client";

export default function PropLoading({ name }: { name: string }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-4 space-y-2 bg-white/90 rounded-lg shadow-md z-50">
      <div className="flex items-center space-x-2">
        <div className="flex space-x-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
          <span
            className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          ></span>
          <span
            className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          ></span>
        </div>
        <span className="text-gray-500 text-sm">{name}</span>
      </div>
    </div>
  );
}
