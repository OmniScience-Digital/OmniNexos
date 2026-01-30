"use client";

import { useEffect } from 'react';
import Home from "./Components/dynamicLanding";
import { generateClient } from 'aws-amplify/data';
import type { Schema } from "amplify/data/resource";

export default function Landing() {

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const client = generateClient<Schema>();
        const { data } = await client.queries.usersList();
        console.log(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    
    fetchUsers();
  }, []);


  return (   
    <main className="flex-1 p-1 mt-20 pb-20">
      <Home />
    </main>
  );
}