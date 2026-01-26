"use client";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 dark:border-gray-100"></div>
      <span className="mt-2">Loading...</span>
    </div>
  );
}
