import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import { useEffect, useState } from 'react';
// import Loading from '@/components/widgets/loading';


Amplify.configure(outputs, { 
  ssr: true 
});

export default function AmplifyProvider({ 
  children 
}: { 
  children: React.ReactNode 
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