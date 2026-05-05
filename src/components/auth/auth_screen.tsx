"use client"

import { useState } from "react";
import { SignInCard } from "./sign-in-card";
import { SignUpCard } from "./sign-up-card";
import type { SignInFlow } from "@/types/schema";
import { ForgotPasswordCard } from "./ForgotPasswordCard";
import { ResetPasswordCard } from "./ResetPasswordCard";


export const AuthScreen = () => {
    const [currentFlow, setCurrentFlow] = useState<SignInFlow>('signIn');
    const [resetEmail, setResetEmail] = useState('');
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#226392]">
            <div className="md:h-auto md:w-105">

                {currentFlow === 'signIn' && (
                    <SignInCard setState={setCurrentFlow} />
                )}
                {currentFlow === 'signUp' && (
                    <SignUpCard setState={setCurrentFlow} />
                )}

                {currentFlow === 'forgotPassword' && (
                    <ForgotPasswordCard
                        setState={setCurrentFlow}
                        setResetEmail={setResetEmail}
                    />
                )}

                {currentFlow === 'resetPassword' && (
                    <ResetPasswordCard
                        email={resetEmail}
                        setState={setCurrentFlow}
                    />
                )}


            </div>
        </div>
    )
};



