import "./amplify-config"; // configures Amplify once
import { useEffect, useState } from "react";
// import Loading from '@/components/widgets/loading';

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(true);
  }, []);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* <Loading/> */}
      </div>
    );
  }

  return <>{children}</>;
}