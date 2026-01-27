import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { SignInFlow } from "@/types/schema";
import { useFormik } from "formik";
import * as Yup from "yup";
import { signUp, resendSignUpCode } from "aws-amplify/auth";
import { VerifyEmailCard } from "./VerifyEmailCard";


interface SignUpCardProps {
    setState: (state: SignInFlow) => void;
}

interface FormValues {
    email: string;
    password: string;
    confirmPassword: string;
}

// Update the validationSchema to include domain validation
const validationSchema = Yup.object({
    email: Yup.string()
        .email('Invalid email address')
        .test(
            'domain-check',
            'Email must contain department domain',
            (value) => {
                if (!value) return false;
                const domain = value.split('@')[1];
                return domain?.includes('omniscience') || domain?.includes('mass');
            }
        )
        .required('Email is required'),
    password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Password is required'),
    confirmPassword: Yup.string()
        .oneOf([Yup.ref('password')], 'Passwords must match')
        .required('Please confirm your password'),
});

export const SignUpCard = ({ setState }: SignUpCardProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    const formik = useFormik<FormValues>({
        initialValues: {
            email: '',
            password: '',
            confirmPassword: ''
        },
        validationSchema,
        onSubmit: async (values) => {
            setIsSubmitting(true);
            setError(null);
            try {
                const { isSignUpComplete } = await signUp({
                    username: values.email, // Use email as username
                    password: values.password,
                    options: {
                        userAttributes: {
                            email: values.email, // Store as email attribute
                        },
                        autoSignIn: true
                    }
                });

                if (!isSignUpComplete) {
                    setUserEmail(values.email);
                    setNeedsVerification(true);
                } else {
                    setState('signIn');
                }
            } catch (err) {
                console.error('Error signing up:', err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsSubmitting(false);
            }
        }
    });

    const handleResendCode = async () => {
        try {
            await resendSignUpCode({ username: userEmail });
        } catch (err) {
            console.error('Error resending code:', err);
            throw err;
        }
    };

    const handleVerificationComplete = () => {
        setState('signIn');
    };

    if (needsVerification) {
        return (
            <VerifyEmailCard
                email={userEmail}
                onVerificationComplete={handleVerificationComplete}
                onResendCode={handleResendCode}
                onChangeEmail={() => {
                    setNeedsVerification(false);
                    formik.resetForm();
                }}
            />
        );
    }

    return (
        <Card className="w-full h-full px-8 py-6">
            <div className="flex items-center w-full justify-center">
                <img
                    src="/assets/logo.png"
                    alt="Logo"
                    width={120}
                    height={80}
                    className="h-10 mr-2"
                />
            </div>
            <CardHeader className="px-0 pt-3 my-5">
                <CardTitle>Sign up to continue</CardTitle>
                <CardDescription>
                    Use your email or another service to continue
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-0 pb-0">
                {error && (
                    <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={formik.handleSubmit} className="space-y-2.5">
                    <div>
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
                        {formik.touched.email && formik.errors.email ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.email}</div>
                        ) : null}
                    </div>
       

                    <div>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Password"
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            value={formik.values.password}
                            disabled={isSubmitting}
                        />
                        {formik.touched.password && formik.errors.password ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.password}</div>
                        ) : null}
                    </div>

                    <div>
                        <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            placeholder="Confirm Password"
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            value={formik.values.confirmPassword}
                            disabled={isSubmitting}
                        />
                        {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
                            <div className="text-red-500 text-xs mt-1">{formik.errors.confirmPassword}</div>
                        ) : null}
                    </div>

                    <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={isSubmitting || !formik.isValid}
                    >
                        {isSubmitting ? 'Signing up...' : 'Continue'}
                    </Button>
                </form>

                <Separator />

                <p className="text-xs text-muted-foreground">
                    Already have an account?{' '}
                    <span
                        onClick={() => setState('signIn')}
                        className="text-sky-700 hover:underline cursor-pointer"
                    >
                        Sign in
                    </span>
                </p>
            </CardContent>
        </Card>
    );
};