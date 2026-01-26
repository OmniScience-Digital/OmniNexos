"use client";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    // <footer className="bg-[#165b8c] mt-auto">
    <footer className="fixed bottom-0 left-0 right-0 bg-[#165b8c] z-50">
      <div className="max-w-screen-xl px-2 py-2 mx-auto">
        <div className="text-center text-xs text-gray-400">
          <span className="block sm:inline">
            &copy; {currentYear} Massive Group • All rights reserved.{" "}
          </span>
          <a className="underline hover:text-teal-300 transition" href="/">
            Terms
          </a>
          <span> • </span>
          <a className="underline hover:text-teal-300 transition" href="/">
            Privacy
          </a>
        </div>
      </div>
    </footer>
  );
}