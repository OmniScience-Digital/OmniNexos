// components/auth/VerifyEmailCard.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmSignUp } from "aws-amplify/auth";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useEffect, useRef, useState } from "react";

interface VerifyEmailCardProps {
  email: string;
  onVerificationComplete: () => void;
  onResendCode: () => Promise<void>;
  onChangeEmail: () => void;
}

const RESEND_COOLDOWN = 30; // seconds

export const VerifyEmailCard = ({ 
  email, 
  onVerificationComplete, 
  onResendCode,
  onChangeEmail 
}: VerifyEmailCardProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Split code into individual digits
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  
  // Auto-focus on mount
  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const validationSchema = Yup.object({
    code: Yup.string()
      .length(6, 'Verification code must be 6 characters')
      .required('Verification code is required')
  });

  const handleDigitChange = (index: number, value: string) => {
    if (!/^[0-9]*$/.test(value)) return;
    
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    
    // Auto-advance to next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }
    
    // Auto-submit if last digit entered
    if (index === 5 && value) {
      handleSubmit({ code: newDigits.join('') });
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
    }
  };

  const handleSubmit = async (values: { code: string }) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmSignUp({
        username: email,
        confirmationCode: values.code
      });
      
      setVerificationSuccess(true);
      setSuccess('Email verified successfully! Redirecting...');
      
      setTimeout(() => {
        onVerificationComplete();
      }, 1500);
    } catch (err) {
      console.error('Error verifying email:', err);
      setVerificationAttempts(prev => prev + 1);
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formik = useFormik({
    initialValues: {
      code: ''
    },
    validationSchema,
    onSubmit: handleSubmit
  });

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    setError(null);
    try {
      await onResendCode();
      setCountdown(RESEND_COOLDOWN);
      setSuccess('New verification code sent!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error resending code:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  if (verificationSuccess) {
    return (
      <Card className="w-full h-full px-8 py-6">
        <CardHeader className="px-0 pt-3 my-5">
          <CardTitle>Email Verified!</CardTitle>
          <CardDescription>
            Your email has been successfully verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="text-green-500 text-sm p-2 bg-green-50 rounded-md text-center">
            {success}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full px-8 py-6">
      <CardHeader className="px-0 pt-3 my-5">
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We've sent a 6-digit code to <span className="font-medium">{email}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-0 pb-0">
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
            {error}
            {verificationAttempts >= 3 && (
              <div className="mt-2">
                Having trouble?{' '}
                <button 
                  onClick={onChangeEmail}
                  className="text-sky-700 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>
        )}
        {success && (
          <div className="text-green-500 text-sm p-2 bg-green-50 rounded-md">
            {success}
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="flex justify-center space-x-2">
            {digits.map((digit, index) => (
              <Input
                key={index}
                id={`digit-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                ref={index === 0 ? codeInputRef : null}
                disabled={isSubmitting}
                className="w-12 h-12 text-center text-xl"
              />
            ))}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || digits.some(d => !d)}
          >
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {countdown > 0 ? (
            <span>Resend code in {countdown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending}
              className="text-sky-700 hover:underline cursor-pointer"
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <button
            onClick={onChangeEmail}
            className="text-sky-700 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </CardContent>
    </Card>
  );
};