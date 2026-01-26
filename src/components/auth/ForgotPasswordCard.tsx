// ForgotPasswordCard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormik } from "formik";
import * as Yup from "yup";
import { resetPassword } from "aws-amplify/auth";
import type { SignInFlow } from "@/types/schema";

interface ForgotPasswordCardProps {
    setState: (state: SignInFlow) => void;
    setResetEmail: (email: string) => void;
    email?: string;
}

export const ForgotPasswordCard = ({ setState, setResetEmail, email }: ForgotPasswordCardProps) => {
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formik = useFormik({
        initialValues: {
            email: email || ''
        },
        validationSchema: Yup.object({
            email: Yup.string()
                .email('Invalid email address')
                .required('Email is required')
        }),
        onSubmit: async (values) => {
            setIsSubmitting(true);
            setError(null);
            try {
                await resetPassword({ username: values.email });
                setResetEmail(values.email);
                setState('resetPassword');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to send reset code');
            } finally {
                setIsSubmitting(false);
            }
        }
    });

    return (
        <Card className="w-full h-full px-8 py-6">
            <CardHeader className="px-0 pt-3 my-5">
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>
                    Enter your email to receive a verification code
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-0 pb-0">
                {error && (
                    <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Email"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.email}
                        disabled={isSubmitting}
                    />
                    {formik.touched.email && formik.errors.email && (
                        <div className="text-red-500 text-xs mt-1">{formik.errors.email}</div>
                    )}

                    <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Sending...' : 'Send Verification Code'}
                    </Button>
                </form>

                <Button 
                    variant="link" 
                    className="w-full text-muted-foreground" 
                    onClick={() => setState('signIn')}
                >
                    Back to Sign In
                </Button>
            </CardContent>
        </Card>
    );
};